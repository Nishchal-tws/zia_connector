import { useState, useRef, useEffect } from 'react';
import './App.css';
import Login from './Login';

// Use relative path for API when deployed on Vercel (same domain)
// Only use absolute URL if REACT_APP_API_URL is explicitly set (for local dev)
const API_BASE = process.env.REACT_APP_API_URL || '';
const API_URL = `${API_BASE}/api/v1/query`;


// Function to parse message content and extract HTML visualizations
const parseMessage = (text) => {
  if (!text) return { text: '', html: null, hasVisualization: false };
  
  console.log('Parsing message, length:', text.length);
  
  // Check if the message contains HTML (visualization) - be more flexible with matching
  const htmlMatch = text.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i) || 
                    text.match(/<html[\s\S]*?<\/html>/i) ||
                    text.match(/<div[^>]*id="[^"]*"[^>]*>[\s\S]*?<script[\s\S]*?Plotly[\s\S]*?<\/script>/i);
  
  if (htmlMatch) {
    console.log('HTML visualization detected!');
    const htmlContent = htmlMatch[0];
    const textBefore = text.substring(0, text.indexOf(htmlMatch[0])).trim();
    const textAfter = text.substring(text.indexOf(htmlMatch[0]) + htmlMatch[0].length).trim();
    const combinedText = [textBefore, textAfter].filter(t => t).join('\n');
    
    console.log('HTML content length:', htmlContent.length);
    console.log('Text before:', textBefore);
    console.log('Text after:', textAfter);
    
    return {
      text: combinedText,
      html: htmlContent,
      hasVisualization: true
    };
  }
  
  console.log('No HTML visualization found');
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

// Function to format markdown text into clean HTML
const formatMessage = (text) => {
  if (!text) return '';
  
  // Split into lines and process each line
  const lines = text.split('\n');
  const formattedLines = lines.map(line => {
    const trimmed = line.trim();
    
    // Remove markdown headers (lines starting with #)
    if (trimmed.startsWith('#')) {
      // Remove all # characters and trim
      const content = trimmed.replace(/^#+\s*/g, '').trim();
      if (content) {
        // Escape HTML first, then convert markdown bold
        const escapedContent = escapeHtml(content);
        const boldContent = escapedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return `<div class="regular-line" style="font-weight: 600; font-size: 1.1em; margin-top: 12px; margin-bottom: 8px;">${boldContent}</div>`;
      }
      return '';
    }
    
    // Handle bullet points with •
    if (trimmed.startsWith('•')) {
      const content = trimmed.substring(1).trim();
      // Escape HTML first, then convert markdown bold
      const escapedContent = escapeHtml(content);
      const boldContent = escapedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<div class="bullet-point">${boldContent}</div>`;
    }
    
    // Handle lines starting with * (but not **)
    if (trimmed.startsWith('*') && !trimmed.startsWith('**')) {
      const content = trimmed.substring(1).trim();
      // Escape HTML first, then convert markdown bold
      const escapedContent = escapeHtml(content);
      const boldContent = escapedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<div class="bullet-point">${boldContent}</div>`;
    }
    
    // Handle indented lines with ◦ or spaces
    if (trimmed.startsWith('◦') || (line.startsWith('   ') && !trimmed.startsWith('*') && !trimmed.startsWith('•'))) {
      const content = trimmed.replace(/^◦\s*/, '').trim();
      // Escape HTML for safety
      const escapedContent = escapeHtml(content);
      return `<div class="indented-item">${escapedContent}</div>`;
    }
    
    // Regular lines - convert **bold** but keep as regular paragraph
    if (trimmed) {
      // Escape HTML first, then convert markdown bold
      const escapedContent = escapeHtml(trimmed);
      const boldContent = escapedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<div class="regular-line">${boldContent}</div>`;
    }
    
    // Empty lines
    return '<br>';
  });
  
  return formattedLines.join('');
};

// Component to render visualization
const VisualizationRenderer = ({ html, messageIndex }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    console.log('VisualizationRenderer useEffect triggered', { html: !!html, hasContainer: !!containerRef.current });
    
    if (!html) {
      console.log('VisualizationRenderer: No HTML provided');
      return;
    }

    // Wait a bit for the container ref to be attached to DOM
    const timer = setTimeout(() => {
      if (!containerRef.current) {
        console.error('VisualizationRenderer: Container ref still not available after timeout');
        return;
      }

      console.log('VisualizationRenderer: Starting render process, HTML length:', html.length);

      // Wait for Plotly to be available
      const waitForPlotly = () => {
        return new Promise((resolve) => {
          if (window.Plotly) {
            console.log('Plotly already loaded');
            resolve();
          } else {
            console.log('Waiting for Plotly to load...');
            const checkInterval = setInterval(() => {
              if (window.Plotly) {
                console.log('Plotly loaded!');
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

        console.log('Parsing HTML...');
        // Use DOMParser to properly parse the full HTML document
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract the script tags
        let scripts = doc.querySelectorAll('script');
        let bodyContent = doc.querySelector('body');
        
        console.log('Found scripts:', scripts.length);
        console.log('Body content found:', !!bodyContent);
        
        // If body not found, try extracting from HTML string directly
        if (!bodyContent) {
          console.log('Body not found in parsed doc, trying to extract from HTML string...');
          const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          if (bodyMatch) {
            console.log('Found body in HTML string');
            // Create a temporary div to parse body content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = bodyMatch[1];
            bodyContent = tempDiv;
            // Also get scripts from the body HTML
            scripts = tempDiv.querySelectorAll('script');
          }
        }
        
        // Also try getting scripts from document head if needed
        const headScripts = doc.querySelectorAll('head script');
        console.log('Head scripts found:', headScripts.length);
        
        if (bodyContent) {
          // Clear container
          containerRef.current.innerHTML = '';
          
          // Find the div that will contain the chart
          const chartDiv = bodyContent.querySelector('[id]');
          console.log('Chart div found:', !!chartDiv, chartDiv?.id);
          
          if (!chartDiv) {
            console.error('No chart div found in HTML');
            containerRef.current.innerHTML = '<p style="color: red;">Error: No chart container found in HTML</p>';
            return;
          }

          // Create unique ID for this message
          const originalId = chartDiv.id;
          const uniqueId = `${originalId}-${messageIndex}`;
          
          console.log('Original ID:', originalId, 'Unique ID:', uniqueId);
          
          // Create the chart container div
          const newChartDiv = document.createElement('div');
          newChartDiv.id = uniqueId;
          
          // Copy styles from original div
          if (chartDiv.style.cssText) {
            newChartDiv.style.cssText = chartDiv.style.cssText;
          } else {
            // Set default styles if not provided
            newChartDiv.style.height = chartDiv.style.height || '450px';
            newChartDiv.style.width = chartDiv.style.width || '100%';
          }
          
          containerRef.current.appendChild(newChartDiv);
          console.log('Chart container div added to DOM');

          // Find and execute the Plotly script
          // Combine body scripts and head scripts
          const allScripts = Array.from(scripts);
          let scriptFound = false;
          
          allScripts.forEach((script, idx) => {
            console.log(`Script ${idx}:`, { hasSrc: !!script.src, hasContent: !!script.textContent, textLength: script.textContent?.length });
            
            if (!script.src && script.textContent) {
              scriptFound = true;
              let scriptContent = script.textContent;
              
              console.log('Original script content:', scriptContent);
              console.log('Original ID:', originalId, 'Unique ID:', uniqueId);
              
              // Replace the original ID with the unique ID
              scriptContent = scriptContent.replace(
                new RegExp(`['"\`]${originalId}['"\`]`, 'g'),
                `"${uniqueId}"`
              );
              
              console.log('Updated script content:', scriptContent);
              
              // Extract data and layout from the script
              try {
                // Try to parse the script to extract data and layout
                // Pattern: var data = [...]; var layout = {...}; Plotly.newPlot(...)
                const dataMatch = scriptContent.match(/var\s+data\s*=\s*(\[[\s\S]*?\]);/);
                const layoutMatch = scriptContent.match(/var\s+layout\s*=\s*(\{[\s\S]*?\});/);
                
                console.log('Data match:', dataMatch ? 'Found' : 'Not found', dataMatch?.[1]?.substring(0, 100));
                console.log('Layout match:', layoutMatch ? 'Found' : 'Not found', layoutMatch?.[1]?.substring(0, 100));
                
                if (dataMatch && layoutMatch) {
                  try {
                    // Parse JSON strings safely
                    let data, layout;
                    
                    try {
                      // Try parsing as JSON first
                      data = JSON.parse(dataMatch[1]);
                      console.log('Data parsed as JSON');
                    } catch {
                      // If not valid JSON, use Function constructor (with eslint disable)
                      console.log('Parsing data with Function constructor');
                      // eslint-disable-next-line no-new-func
                      const parseData = new Function('return ' + dataMatch[1]);
                      data = parseData();
                    }
                    
                    try {
                      layout = JSON.parse(layoutMatch[1]);
                      console.log('Layout parsed as JSON');
                    } catch {
                      console.log('Parsing layout with Function constructor');
                      // eslint-disable-next-line no-new-func
                      const parseLayout = new Function('return ' + layoutMatch[1]);
                      layout = parseLayout();
                    }
                    
                    console.log('Parsed data:', data);
                    console.log('Parsed layout:', layout);
                    console.log('Rendering Plotly chart with ID:', uniqueId);
                    
                    // Use Plotly directly
                    window.Plotly.newPlot(uniqueId, data, layout).then(() => {
                      console.log('Plotly chart rendered successfully');
                    }).catch(err => {
                      console.error('Plotly render error:', err);
                    });
                  } catch (parseError) {
                    console.error('Error parsing Plotly data:', parseError);
                    // Fallback to executing script
                    console.log('Falling back to script execution');
                    const newScript = document.createElement('script');
                    newScript.textContent = scriptContent;
                    containerRef.current.appendChild(newScript);
                  }
                } else {
                  // Fallback: execute the script directly
                  console.log('No data/layout match found, executing script directly');
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
    console.log('VisualizationRenderer: No HTML provided');
    return null;
  }

  console.log('VisualizationRenderer: Rendering container div');

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
    if (!user) return [{ id: Date.now(), title: 'New Chat', messages: [], createdAt: new Date() }];
    
    try {
      const userStorageKey = `${STORAGE_KEY}_${user.email}`;
      const stored = localStorage.getItem(userStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        return parsed.map(chat => ({
          ...chat,
          createdAt: new Date(chat.createdAt),
          messages: chat.messages || []
        }));
      }
    } catch (error) {
      console.error('Error loading chats from storage:', error);
    }
    // Default: create a new chat if nothing stored
    return [{ id: Date.now(), title: 'New Chat', messages: [], createdAt: new Date() }];
  };

  const [chats, setChats] = useState(() => {
    if (!user) return [{ id: Date.now(), title: 'New Chat', messages: [], createdAt: new Date() }];
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
  const messagesEndRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Handle login
  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    // Reload chats for this user
    const userStorageKey = `${STORAGE_KEY}_${userData.email}`;
    const stored = localStorage.getItem(userStorageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      setChats(parsed.map(chat => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
        messages: chat.messages || []
      })));
    } else {
      setChats([{ id: Date.now(), title: 'New Chat', messages: [], createdAt: new Date() }]);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setChats([{ id: Date.now(), title: 'New Chat', messages: [], createdAt: new Date() }]);
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

  const activeChat = chats.find(chat => chat.id === activeChatId) || chats[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages]);

  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setInput('');
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
        body: JSON.stringify({ query: messageContent }),
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
      console.log('Received response from API:', data);
      console.log('Answer length:', data.answer?.length || 0);
      console.log('Answer preview:', data.answer?.substring(0, 200) || 'No answer');
      
      const parsedContent = parseMessage(data.answer || 'No response received.');
      console.log('Parsed content:', parsedContent);
      
      const assistantMessage = {
        role: 'assistant',
        content: parsedContent.text,
        htmlContent: parsedContent.html,
        hasVisualization: parsedContent.hasVisualization,
        contexts: data.contexts || null,
      };
      
      console.log('Adding assistant message:', assistantMessage);
      
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
      <div className="app-layout">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <button className="new-chat-btn" onClick={createNewChat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Chat
            </button>
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {sidebarOpen ? (
                  <polyline points="15 18 9 12 15 6"></polyline>
                ) : (
                  <polyline points="9 18 15 12 9 6"></polyline>
                )}
              </svg>
            </button>
          </div>
          <div className="chat-list">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => switchChat(chat.id)}
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
        </div>

        {/* Main Chat Area */}
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-left">
              <button 
                className="menu-toggle-btn" 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              <h1>Zia</h1>
              {user && <span className="user-info">Welcome, {user.username || user.email}</span>}
            </div>
            <div className="chat-header-right">
              <button className="clear-btn" onClick={clearChat} title="Clear chat">
                Clear
              </button>
              <button className="logout-btn" onClick={handleLogout} title="Logout">
                Logout
              </button>
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
