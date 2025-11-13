import { useState, useRef, useEffect } from 'react';
import './App.css';
import Login from './Login';
import ziaLogo from './assets/zialogo.svg';

// Use relative path for API when deployed on Vercel (same domain)
// Only use absolute URL if REACT_APP_API_URL is explicitly set (for local dev)
const API_BASE = process.env.REACT_APP_API_URL || '';
const API_URL = `${API_BASE}/api/v1/query`;
const DEFAULT_CHAT_SOURCE = 'crm';
const CHAT_SOURCES = [
  { value: 'crm', label: 'Zoho CRM' },
  { value: 'mail', label: 'Zoho Mail' },
];

// Function to parse message content and extract HTML visualizations
const parseMessage = (text) => {
  if (!text) return { text: '', html: null, hasVisualization: false };
  
  // Check if the message contains HTML (visualization) - be more flexible with matching
  const htmlMatch = text.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i) || 
                    text.match(/<html[\s\S]*?<\/html>/i) ||
                    text.match(/<div[^>]*id="[^"]*"[^>]*>[\s\S]*?<script[\s\S]*?Plotly[\s\S]*?<\/script>/i);
  
  if (htmlMatch) {
    const htmlContent = htmlMatch[0];
    const textBefore = text.substring(0, text.indexOf(htmlMatch[0])).trim();
    const textAfter = text.substring(text.indexOf(htmlMatch[0]) + htmlMatch[0].length).trim();
    const combinedText = [textBefore, textAfter].filter(t => t).join('\n');
    
    return {
      text: combinedText,
      html: htmlContent,
      hasVisualization: true
    };
  }
  
  return {
    text: text,
    html: null,
    hasVisualization: false
  };
};

// Function to escape HTML special characters to prevent XSS
const escapeHtml = (text) => {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Function to convert markdown table to HTML
const convertMarkdownTable = (tableText) => {
  const rows = tableText.trim().split('\n').filter(row => row.trim());
  if (rows.length < 2) return null;
  
  // Find separator row (contains dashes, pipes, and optionally colons)
  let separatorIndex = -1;
  for (let j = 1; j < Math.min(rows.length, 5); j++) {
    const row = rows[j].trim();
    // Check if it's a separator: contains | and dashes, mostly dashes/pipes/colons/spaces
    if (row.includes('|') && /^[\s|:-]+$/.test(row)) {
      separatorIndex = j;
      break;
    }
  }
  
  // Header row
  const headerRow = rows[0];
  // Data rows (skip separator if found)
  const dataRows = separatorIndex > 0 ? rows.slice(separatorIndex + 1) : rows.slice(1);
  
  // Parse header cells
  const parseRow = (row) => {
    const parts = row.split('|').map(p => p.trim());
    // Remove empty strings at start/end if row starts/ends with |
    if (parts.length > 0 && parts[0] === '' && row.trim().startsWith('|')) {
      parts.shift();
    }
    if (parts.length > 0 && parts[parts.length - 1] === '' && row.trim().endsWith('|')) {
      parts.pop();
    }
    return parts;
  };
  
  const headerCells = parseRow(headerRow)
    .map(cell => {
      // Escape HTML but allow markdown bold
      const escaped = escapeHtml(cell);
      const withBold = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<th>${withBold}</th>`;
    })
    .join('');
  
  // Parse data rows
  const bodyRows = dataRows
    .filter(row => row.trim() && row.includes('|'))
    .map(row => {
      const cells = parseRow(row)
        .map(cell => {
          const escaped = escapeHtml(cell);
          const withBold = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          return `<td>${withBold}</td>`;
        })
        .join('');
      
      return cells ? `<tr>${cells}</tr>` : '';
    })
    .filter(row => row)
    .join('');
  
  if (!headerCells) return null;
  
  return `
    <div class="table-wrapper">
      <table class="markdown-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows || '<tr><td colspan="100%">No data</td></tr>'}</tbody>
      </table>
    </div>
  `;
};

// Function to format markdown text into clean HTML
const formatMessage = (text) => {
  if (!text) return '';
  
  // Step 1: Detect and extract markdown tables
  // More flexible regex: matches table blocks with header, separator, and data rows
  // Pattern: lines with |, then separator line with dashes, then more lines with |
  const lines = text.split('\n');
  const processedParts = [];
  let i = 0;
  
  while (i < lines.length) {
    // Check if current line looks like it might be part of a table
    const currentLine = lines[i];
    
    // Look for table pattern: line with |, followed by separator, followed by data rows
    if (currentLine.includes('|')) {
      // Try to find a complete table starting from this line
      let tableLines = [currentLine];
      let j = i + 1;
      let foundSeparator = false;
      
      // Look ahead for separator and data rows
      while (j < lines.length && j < i + 50) { // Limit search to prevent issues
        const nextLine = lines[j];
        
        // Check if it's a separator line
        if (!foundSeparator && nextLine.includes('|') && /^[\s|:-]+$/.test(nextLine.trim())) {
          foundSeparator = true;
          tableLines.push(nextLine);
          j++;
          continue;
        }
        
        // If we found separator, look for data rows
        if (foundSeparator) {
          if (nextLine.includes('|') && nextLine.trim()) {
            tableLines.push(nextLine);
            j++;
          } else if (nextLine.trim() === '') {
            // Empty line might be part of table or end of table
            tableLines.push(nextLine);
            j++;
            // If next non-empty line doesn't have |, end the table
            let k = j;
            while (k < lines.length && lines[k].trim() === '') k++;
            if (k < lines.length && !lines[k].includes('|')) {
              break;
            }
          } else {
            // Non-table line, end table
            break;
          }
        } else {
          // Haven't found separator yet
          if (nextLine.includes('|') && nextLine.trim()) {
            tableLines.push(nextLine);
            j++;
          } else if (nextLine.trim() === '' && j < i + 3) {
            // Allow one empty line early on
            j++;
          } else {
            // Not a table, break
            break;
          }
        }
      }
      
      // If we found a separator and have at least 3 lines (header + separator + at least 1 data row)
      if (foundSeparator && tableLines.length >= 3) {
        const tableText = tableLines.join('\n');
        const tableHTML = convertMarkdownTable(tableText);
        
        if (tableHTML) {
          // Valid table found, add it and skip those lines
          processedParts.push({ type: 'table', content: tableHTML });
          i = j;
          continue;
        }
      }
      
      // If we have multiple lines with | but no separator, it might still be a table
      // Check if we have at least 2 lines with | and they look like table rows
      if (!foundSeparator && tableLines.length >= 2) {
        // Check if all lines have similar structure (similar number of | characters)
        const pipeCounts = tableLines.map(l => (l.match(/\|/g) || []).length);
        const firstPipeCount = pipeCounts[0];
        const allSimilar = pipeCounts.every(count => Math.abs(count - firstPipeCount) <= 1);
        
        if (allSimilar && firstPipeCount >= 2) {
          // Might be a table without separator, try converting it
          const tableText = tableLines.join('\n');
          const tableHTML = convertMarkdownTable(tableText);
          
          if (tableHTML) {
            processedParts.push({ type: 'table', content: tableHTML });
            i = j;
            continue;
          }
        }
      }
      
      // If it wasn't a valid table, treat first line as regular text
    }
    
    // Not a table line, process as regular text
    processedParts.push({ type: 'line', content: currentLine });
    i++;
  }
  
  // Step 2: Format each part
  const formattedParts = [];
  
  for (let idx = 0; idx < processedParts.length; idx++) {
    const part = processedParts[idx];
    if (part.type === 'table') {
      // Table HTML is already ready, just add it
      // Add spacing before table if previous part was not a table
      if (idx > 0 && processedParts[idx - 1].type !== 'table') {
        formattedParts.push('<br>');
      }
      formattedParts.push(part.content);
      // Add spacing after table if next part is not a table
      if (idx < processedParts.length - 1 && processedParts[idx + 1].type !== 'table') {
        formattedParts.push('<br>');
      }
    } else {
      // Process as regular line
      const line = part.content;
      const trimmed = line.trim();
      
      // Handle markdown headers (lines starting with #)
      if (trimmed.startsWith('#')) {
        const content = trimmed.replace(/^#+\s*/g, '').trim();
        if (content) {
          const escapedContent = escapeHtml(content);
          const boldContent = escapedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          formattedParts.push(`<div class="regular-line" style="font-weight: 600; font-size: 1.1em; margin-top: 0px; margin-bottom: 0px;">${boldContent}</div>`);
        }
        continue;
      }
      
      // Handle bullet points with •
      if (trimmed.startsWith('•')) {
        const content = trimmed.substring(1).trim();
        const escapedContent = escapeHtml(content);
        const boldContent = escapedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedParts.push(`<div class="bullet-point">${boldContent}</div>`);
        continue;
      }
      
      // Handle lines starting with * (but not **)
      if (trimmed.startsWith('*') && !trimmed.startsWith('**')) {
        const content = trimmed.substring(1).trim();
        const escapedContent = escapeHtml(content);
        const boldContent = escapedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedParts.push(`<div class="bullet-point">${boldContent}</div>`);
        continue;
      }
      
      // Handle indented lines with ◦ or spaces
      if (trimmed.startsWith('◦') || (line.startsWith('   ') && !trimmed.startsWith('*') && !trimmed.startsWith('•'))) {
        const content = trimmed.replace(/^◦\s*/, '').trim();
        const escapedContent = escapeHtml(content);
        formattedParts.push(`<div class="indented-item">${escapedContent}</div>`);
        continue;
      }
      
      // Regular lines - convert **bold** but keep as regular paragraph
      if (trimmed) {
        const escapedContent = escapeHtml(trimmed);
        const boldContent = escapedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedParts.push(`<div class="regular-line">${boldContent}</div>`);
        continue;
      }
      
      // Empty lines
      formattedParts.push('<br>');
    } 
  }
  
  return formattedParts.join('');
};


// Component to render visualization
const VisualizationRenderer = ({ html, messageIndex }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!html) {
      return;
    }

    // Wait a bit for the container ref to be attached to DOM
    const timer = setTimeout(() => {
      if (!containerRef.current) {
        console.error('VisualizationRenderer: Container ref still not available after timeout');
        return;
      }

      // Wait for Plotly to be available
      const waitForPlotly = () => {
        return new Promise((resolve) => {
          if (window.Plotly) {
            resolve();
          } else {
            const checkInterval = setInterval(() => {
              if (window.Plotly) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
            
            // Timeout after 5 seconds
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 5000);
          }
        });
      };

      const renderVisualization = async () => {
        // Wait for Plotly
        await waitForPlotly();
        
        if (!window.Plotly) {
          console.error('Plotly library not loaded');
          if (containerRef.current) {
            containerRef.current.innerHTML = '<p style="color: red;">Error: Plotly library failed to load</p>';
          }
          return;
        }

        if (!containerRef.current) {
          console.error('Container ref lost during render');
          return;
        }

        // Use DOMParser to properly parse the full HTML document
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract the script tags
        let scripts = doc.querySelectorAll('script');
        let bodyContent = doc.querySelector('body');
        
        // If body not found, try extracting from HTML string directly
        if (!bodyContent) {
          const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          if (bodyMatch) {
            // Create a temporary div to parse body content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = bodyMatch[1];
            bodyContent = tempDiv;
            // Also get scripts from the body HTML
            scripts = tempDiv.querySelectorAll('script');
          }
        }
        
        if (bodyContent) {
          // Clear container
          containerRef.current.innerHTML = '';
          
          // Find the div that will contain the chart
          const chartDiv = bodyContent.querySelector('[id]');
          
          if (!chartDiv) {
            console.error('No chart div found in HTML');
            containerRef.current.innerHTML = '<p style="color: red;">Error: No chart container found in HTML</p>';
            return;
          }

          // Create unique ID for this message
          const originalId = chartDiv.id;
          const uniqueId = `${originalId}-${messageIndex}`;
          
          // Create the chart container div
          const newChartDiv = document.createElement('div');
          newChartDiv.id = uniqueId;
          
          // Copy styles from original div
          if (chartDiv.style.cssText) {
            newChartDiv.style.cssText = chartDiv.style.cssText;
          } else {
            // Set default styles if not provided
            newChartDiv.style.height = chartDiv.style.height || '440px';
            newChartDiv.style.width = chartDiv.style.width || '100%';
          }
          
          containerRef.current.appendChild(newChartDiv);

          // Find and execute the Plotly script
          const allScripts = Array.from(scripts);
          let scriptFound = false;
          
          allScripts.forEach((script) => {
            if (!script.src && script.textContent) {
              scriptFound = true;
              let scriptContent = script.textContent;
              
              // Replace the original ID with the unique ID
              scriptContent = scriptContent.replace(
                new RegExp(`['"\`]${originalId}['"\`]`, 'g'),
                `"${uniqueId}"`
              );
              
              // Extract data and layout from the script
              try {
                const dataMatch = scriptContent.match(/var\s+data\s*=\s*(\[[\s\S]*?\]);/);
                const layoutMatch = scriptContent.match(/var\s+layout\s*=\s*(\{[\s\S]*?\});/);
                
                if (dataMatch && layoutMatch) {
                  try {
                    // Parse JSON strings safely
                    let data, layout;
                    
                    try {
                      data = JSON.parse(dataMatch[1]);
                    } catch {
                      // eslint-disable-next-line no-new-func
                      const parseData = new Function('return ' + dataMatch[1]);
                      data = parseData();
                    }
                    
                    try {
                      layout = JSON.parse(layoutMatch[1]);
                    } catch {
                      // eslint-disable-next-line no-new-func
                      const parseLayout = new Function('return ' + layoutMatch[1]);
                      layout = parseLayout();
                    }
                    
                    // Use Plotly directly
                    window.Plotly.newPlot(uniqueId, data, layout).catch(err => {
                      console.error('Plotly render error:', err);
                    });
                  } catch (parseError) {
                    console.error('Error parsing Plotly data:', parseError);
                    // Fallback to executing script
                    const newScript = document.createElement('script');
                    newScript.textContent = scriptContent;
                    containerRef.current.appendChild(newScript);
                  }
                } else {
                  // Fallback: execute the script directly
                  const newScript = document.createElement('script');
                  newScript.textContent = scriptContent;
                  containerRef.current.appendChild(newScript);
                }
              } catch (error) {
                console.error('Error executing visualization script:', error);
                if (containerRef.current) {
                  containerRef.current.innerHTML = `<p style="color: red;">Error rendering chart: ${error.message}</p>`;
                }
              }
            }
          });
          
          if (!scriptFound) {
            console.error('No inline script found in HTML');
            containerRef.current.innerHTML = '<p style="color: red;">Error: No script tag found in visualization HTML</p>';
          }
        } else {
          console.error('No body content found in HTML');
          if (containerRef.current) {
            containerRef.current.innerHTML = '<p style="color: red;">Error: Invalid HTML structure</p>';
          }
        }
      };

      renderVisualization();
    }, 100);

    return () => clearTimeout(timer);
  }, [html, messageIndex]);

  if (!html) {
    return null;
  }

  return (
    <div 
      ref={containerRef} 
      className="visualization-container"
      key={`viz-${messageIndex}`}
    />
  );
};

const STORAGE_KEY = 'zia_chats';
const ACTIVE_CHAT_KEY = 'zia_active_chat_id';
const USER_KEY = 'user';
const TOKEN_KEY = 'auth_token';

function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);

  // Load chats from localStorage on mount (user-specific)
  const loadChatsFromStorage = () => {
    if (!user) {
      return [{
        id: Date.now(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date(),
        chatSource: DEFAULT_CHAT_SOURCE,
      }];
    }
    
    try {
      const userStorageKey = `${STORAGE_KEY}_${user.email}`;
      const stored = localStorage.getItem(userStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        return parsed.map(chat => ({
          ...chat,
          createdAt: new Date(chat.createdAt),
          messages: chat.messages || [],
          chatSource: chat.chatSource || DEFAULT_CHAT_SOURCE,
        }));
      }
    } catch (error) {
      console.error('Error loading chats from storage:', error);
    }
    // Default: create a new chat if nothing stored
    return [{
      id: Date.now(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      chatSource: DEFAULT_CHAT_SOURCE,
    }];
  };

  const [chats, setChats] = useState(() => {
    if (!user) {
      return [{
        id: Date.now(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date(),
        chatSource: DEFAULT_CHAT_SOURCE,
      }];
    }
    return loadChatsFromStorage();
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    if (!user) return null;
    try {
      const userActiveKey = `${ACTIVE_CHAT_KEY}_${user.email}`;
      const stored = localStorage.getItem(userActiveKey);
      return stored ? parseInt(stored) : null;
    } catch {
      return null;
    }
  });

  // Reload chats when user changes
  useEffect(() => {
    if (user) {
      const loadedChats = loadChatsFromStorage();
      setChats(loadedChats);
      if (loadedChats.length > 0 && !activeChatId) {
        setActiveChatId(loadedChats[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const messagesEndRef = useRef(null);
  const modelSelectorRef = useRef(null);
  const profileMenuRef = useRef(null);
  // Sidebar starts open on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return window.innerWidth > 768;
  });

  // Handle login
  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    setProfileMenuOpen(false);
    setModelMenuOpen(false);
    // Reload chats for this user
    const userStorageKey = `${STORAGE_KEY}_${userData.email}`;
    const stored = localStorage.getItem(userStorageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      setChats(parsed.map(chat => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
        messages: chat.messages || [],
        chatSource: chat.chatSource || DEFAULT_CHAT_SOURCE,
      })));
    } else {
      setChats([{
        id: Date.now(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date(),
        chatSource: DEFAULT_CHAT_SOURCE,
      }]);
    }
  };

  // Handle logout
  const handleLogout = () => {
    setProfileMenuOpen(false);
    setModelMenuOpen(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setChats([{
      id: Date.now(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      chatSource: DEFAULT_CHAT_SOURCE,
    }]);
    setActiveChatId(null);
  };

  // Save chats to localStorage whenever they change (user-specific)
  useEffect(() => {
    if (!user) return;
    try {
      const userStorageKey = `${STORAGE_KEY}_${user.email}`;
      localStorage.setItem(userStorageKey, JSON.stringify(chats));
    } catch (error) {
      console.error('Error saving chats to storage:', error);
    }
  }, [chats, user]);

  // Save active chat ID to localStorage (user-specific)
  useEffect(() => {
    if (activeChatId && user) {
      try {
        const userActiveKey = `${ACTIVE_CHAT_KEY}_${user.email}`;
        localStorage.setItem(userActiveKey, activeChatId.toString());
      } catch (error) {
        console.error('Error saving active chat ID:', error);
      }
    }
  }, [activeChatId, user]);

  // Set first chat as active on mount if no active chat
  useEffect(() => {
    if (chats.length > 0 && !activeChatId && user) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId, user]);

  // Handle window resize to adjust sidebar state for mobile/desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    // Set initial state on mount
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeChat = chats.find(chat => chat.id === activeChatId) || chats[0];
  const currentChatSource = activeChat?.chatSource || DEFAULT_CHAT_SOURCE;
  const currentChatLabel =
    CHAT_SOURCES.find((source) => source.value === currentChatSource)?.label || 'Zoho CRM';
  const userDisplayName = user?.username || user?.email || 'User';
  const userEmail = user?.email;
  const userInitial = userDisplayName.charAt(0).toUpperCase();
  const isClearDisabled = !activeChat || activeChat.messages.length === 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target)) {
        setModelMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      chatSource: activeChat?.chatSource || DEFAULT_CHAT_SOURCE,
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setInput('');
    // Close sidebar on mobile after creating new chat
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const switchChat = (chatId) => {
    setActiveChatId(chatId);
    setInput('');
  };

  const deleteChat = (chatId, e) => {
    e.stopPropagation();
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    setChats(updatedChats);
    
    if (activeChatId === chatId) {
      if (updatedChats.length > 0) {
        setActiveChatId(updatedChats[0].id);
      } else {
        createNewChat();
      }
    }
  };

  const handleChatSourceChange = (newSource) => {
    if (!activeChatId) {
      setModelMenuOpen(false);
      return;
    }
    const normalizedSource = (newSource || DEFAULT_CHAT_SOURCE).toLowerCase();
    const currentSource = activeChat?.chatSource || DEFAULT_CHAT_SOURCE;
    
    // Only proceed if source actually changed
    if (normalizedSource === currentSource) {
      setModelMenuOpen(false);
      return;
    }
    
    // Get the label for the notification
    const sourceLabel = CHAT_SOURCES.find(s => s.value === normalizedSource)?.label || normalizedSource;
    
    // Show notification
    setNotification({
      message: `Switched to ${sourceLabel} data source`,
      type: 'success'
    });
    
    // Auto-hide notification after 3 seconds
    setTimeout(() => {
      setNotification(null);
    }, 3000);
    
    // Create a new chat with the new source
    const newChat = {
      id: Date.now(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      chatSource: normalizedSource,
    };
    
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setInput('');
    setModelMenuOpen(false);
    
    // Close sidebar on mobile after switching
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const handleModelSelect = (sourceValue) => {
    handleChatSourceChange(sourceValue);
  };

  const toggleModelMenu = () => {
    if (loading) return;
    setModelMenuOpen(prev => !prev);
  };

  const toggleProfileMenu = () => {
    setProfileMenuOpen(prev => !prev);
  };

  const updateChatTitle = (chatId, messages) => {
    // Generate title from conversation context
    let title = 'New Chat';
    
    if (messages && messages.length > 0) {
      // Try to get a meaningful title from the conversation
      const firstUserMessage = messages.find(m => m.role === 'user');
      const firstAssistantMessage = messages.find(m => m.role === 'assistant');
      
      if (firstUserMessage && firstUserMessage.content) {
        // Use first user message, cleaned up
        let content = firstUserMessage.content.trim();
        // Remove markdown formatting
        content = content.replace(/\*\*/g, '').replace(/\*/g, '').replace(/•/g, '').replace(/◦/g, '');
        // Take first 40 characters
        title = content.substring(0, 40);
        if (content.length > 40) title += '...';
      } else if (firstAssistantMessage && firstAssistantMessage.content) {
        // Fallback to assistant's first response
        let content = firstAssistantMessage.content.trim();
        content = content.replace(/\*\*/g, '').replace(/\*/g, '').replace(/•/g, '').replace(/◦/g, '');
        title = content.substring(0, 40);
        if (content.length > 40) title += '...';
      }
      
      // Clean up title
      title = title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (!title || title.length === 0) {
        title = 'New Chat';
      }
    }
    
    setChats(prev => prev.map(chat => 
      chat.id === chatId && (chat.title === 'New Chat' || chat.title.length < 5)
        ? { ...chat, title } 
        : chat
    ));
  };

  // Update title when messages change
  useEffect(() => {
    if (activeChatId && activeChat) {
      const currentChat = chats.find(c => c.id === activeChatId);
      if (currentChat && currentChat.messages.length > 0) {
        updateChatTitle(activeChatId, currentChat.messages);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.messages.length]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !activeChatId) return;

    const userMessage = { role: 'user', content: input.trim() };
    
    // Update chat with new message
    setChats(prev => prev.map(chat => 
      chat.id === activeChatId 
        ? { ...chat, messages: [...chat.messages, userMessage] }
        : chat
    ));

    const messageContent = input.trim();
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: messageContent,
          chat_source: activeChat?.chatSource || DEFAULT_CHAT_SOURCE,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          handleLogout();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const parsedContent = parseMessage(data.answer || 'No response received.');
      
      const assistantMessage = {
        role: 'assistant',
        content: parsedContent.text,
        htmlContent: parsedContent.html,
        hasVisualization: parsedContent.hasVisualization,
        contexts: data.contexts || null,
      };
      
      // Update chat with assistant response
      setChats(prev => {
        const updatedChats = prev.map(chat => 
          chat.id === activeChatId 
            ? { ...chat, messages: [...chat.messages, assistantMessage] }
            : chat
        );
        
        // Update title after getting response (if this is early in conversation)
        const updatedChat = updatedChats.find(c => c.id === activeChatId);
        if (updatedChat && updatedChat.messages.length <= 2) {
          setTimeout(() => {
            updateChatTitle(activeChatId, updatedChat.messages);
          }, 100);
        }
        
        return updatedChats;
      });
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: `Error: ${error.message}. Please make sure the backend server is running.`,
        isError: true,
      };
      
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, messages: [...chat.messages, errorMessage] }
          : chat
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (activeChatId) {
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, messages: [] }
          : chat
      ));
    }
  };

  // Show login page if not authenticated
  if (!isAuthenticated || !token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <div className="notification-content">
            <svg className="notification-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>{notification.message}</span>
          </div>
        </div>
      )}
      <div className="app-layout">
        {/* Mobile backdrop */}
        <div 
          className={`sidebar-backdrop ${sidebarOpen ? 'active' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
        {/* Sidebar */}
        <div className={`sidebar ${!sidebarOpen ? 'closed' : ''}`}>
          <div className="sidebar-top">
            <img src={ziaLogo} alt="Zia" className="zia-logo" />
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {sidebarOpen ? (
                  <polyline points="15 18 9 12 15 6"></polyline>
                ) : (
                  <polyline points="9 18 15 12 9 6"></polyline>
                )}
              </svg>
            </button>
          </div>
          <div className="sidebar-actions">
            <button className="new-chat-btn" onClick={createNewChat} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Chat
            </button>
          </div>
          <div className="chat-list">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => {
                  switchChat(chat.id);
                  // Close sidebar on mobile after selecting chat
                  if (window.innerWidth <= 768) {
                    setSidebarOpen(false);
                  }
                }}
              >
                <div className="chat-item-content">
                  <div className="chat-item-title">{chat.title}</div>
                  <div className="chat-item-time">
                    {new Date(chat.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="chat-item-delete"
                  onClick={(e) => deleteChat(chat.id, e)}
                  title="Delete chat"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <button
              className="clear-btn"
              onClick={clearChat}
              title="Clear chat"
              type="button"
              disabled={isClearDisabled}
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-left">
              <button 
                className="menu-toggle-btn" 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              <div className="model-selector-wrapper" ref={modelSelectorRef}>
                <button
                  className={`model-selector ${modelMenuOpen ? 'open' : ''}`}
                  onClick={toggleModelMenu}
                  disabled={loading}
                  type="button"
                >
                  <span className="model-label">{currentChatLabel}</span>
                  <span className="dropdown-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </span>
                </button>
                {modelMenuOpen && (
                  <div className="model-dropdown">
                    {CHAT_SOURCES.map((source) => {
                      const isActive = currentChatSource === source.value;
                      return (
                        <button
                          key={source.value}
                          className={`model-option ${isActive ? 'active' : ''}`}
                          onClick={() => handleModelSelect(source.value)}
                          type="button"
                        >
                          <span>{source.label}</span>
                          {isActive && (
                            <svg className="model-option-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="chat-header-right" ref={profileMenuRef}>
              <button
                className={`profile-button ${profileMenuOpen ? 'open' : ''}`}
                onClick={toggleProfileMenu}
                type="button"
                title="Account options"
              >
                <span className="profile-initial">{userInitial}</span>
                <svg className={`profile-dropdown-icon ${profileMenuOpen ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {profileMenuOpen && (
                <div className="profile-menu">
                  <div className="profile-details">
                    <span className="profile-name">{userDisplayName}</span>
                    {userEmail && <span className="profile-email">{userEmail}</span>}
                  </div>
                  <button className="profile-logout-btn" onClick={handleLogout} type="button">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="messages-container">
            {activeChat && activeChat.messages.length === 0 && (
              <div className="welcome-message">
                <h2>Welcome to Zia</h2>
                <p>Start a conversation by typing a message below.</p>
              </div>
            )}
            
            {activeChat && activeChat.messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-content">
                  <div className="message-role">
                    {message.role === 'user' ? 'You' : 'Zia'}
                  </div>
                  {message.content && (
                    <div 
                      className={`message-text ${message.isError ? 'error' : ''}`}
                      dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                    />
                  )}
                  {message.hasVisualization && message.htmlContent && (
                    <VisualizationRenderer html={message.htmlContent} messageIndex={index} />
                  )}
                  {message.contexts && message.contexts.length > 0 && (
                    <div className="contexts">
                      <small>Sources: {message.contexts.length} context(s)</small>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="message assistant">
                <div className="message-content">
                  <div className="message-role">Zia</div>
                  <div className="message-text">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <div className="input-container">
            <textarea
              className="message-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your query here..."
              rows="1"
              disabled={loading}
            />
            <button
              className="send-button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
