import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bell, Search, User, Calendar, List, Settings, Plus, X, Clock, MapPin, Video, Repeat, Tag, AlertCircle } from 'lucide-react';

// Sample tasks data
const sampleTasks = [
  {
    id: 1,
    title: "Buy groceries",
    completed: false,
    category: "Personal",
    dueDate: new Date().toISOString().split('T')[0]
  },
  {
    id: 2,
    title: "Finish project report",
    completed: false,
    category: "Work",
    dueDate: new Date().toISOString().split('T')[0]
  },
  {
    id: 3,
    title: "Call mom",
    completed: true,
    category: "Personal",
    dueDate: new Date().toISOString().split('T')[0]
  }
];

// List of all available tags
const availableTags = ["Meeting", "Deadline", "Call", "Urgent", "Follow-up"];
const categories = ["Work", "Personal", "Urgent"];
const eventColors = ["#4285f4", "#ea4335", "#34a853", "#fbbc05", "#46bdc6", "#7986cb", "#8e24aa"];

// Calendar Utilities
const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const generateMonthDays = (year, month) => {
  const result = [];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Add empty slots for days before the first of the month
  for (let i = 0; i < firstDay; i++) {
    result.push(null);
  }
  
  // Add days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    result.push(i);
  }
  
  return result;
};

const getCurrentTimeOffset = () => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(7, 0, 0, 0);
  const diffInMinutes = (now - startOfDay) / (1000 * 60);
  return diffInMinutes;
};

function App() {
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(now);
  const [currentView, setCurrentView] = useState('Day');
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState(sampleTasks);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [timeIndicatorOffset, setTimeIndicatorOffset] = useState(getCurrentTimeOffset());
  const [searchQuery, setSearchQuery] = useState('');
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: now.toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    color: '#4285f4',
    location: '',
    hasVideoLink: false,
    isTask: false
  });

  const detectOverlaps = (eventsList, date) => {
    // Filter events for the specified date
    const dateEvents = eventsList.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getDate() === date.getDate() && 
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
    });
    
    // Sort events by start time primarily, and by end time (longer events first) for same start times
    dateEvents.sort((a, b) => {
      const aStart = parseInt(a.startTime.replace(':', ''));
      const bStart = parseInt(b.startTime.replace(':', ''));
      
      if (aStart === bStart) {
        // If start times are the same, sort by duration (longer first)
        const [aEndHour, aEndMinute] = a.endTime.split(':').map(Number);
        const [bEndHour, bEndMinute] = b.endTime.split(':').map(Number);
        const aEnd = aEndHour * 60 + aEndMinute;
        const bEnd = bEndHour * 60 + bEndMinute;
        
        const [aStartHour, aStartMinute] = a.startTime.split(':').map(Number);
        const [bStartHour, bStartMinute] = b.startTime.split(':').map(Number);
        const aStartMins = aStartHour * 60 + aStartMinute;
        const bStartMins = bStartHour * 60 + bStartMinute;
        
        return (bEnd - bStartMins) - (aEnd - aStartMins); // Longer duration first
      }
      
      return aStart - bStart;
    });
    
    // Detect overlaps and assign columns
    const processed = [];
    
    dateEvents.forEach(event => {
      // Parse times for current event
      const [startHour, startMinute] = event.startTime.split(':').map(Number);
      const [endHour, endMinute] = event.endTime.split(':').map(Number);
      const eventStart = startHour * 60 + startMinute;
      const eventEnd = endHour * 60 + endMinute;
      
      // Find overlapping events that have already been processed
      const overlaps = processed.filter(p => {
        const [pStartHour, pStartMinute] = p.startTime.split(':').map(Number);
        const [pEndHour, pEndMinute] = p.endTime.split(':').map(Number);
        const pStart = pStartHour * 60 + pStartMinute;
        const pEnd = pEndHour * 60 + pEndMinute;
        
        // Check if events overlap - include exact same start time as an overlap
        return (eventStart <= pEnd && eventEnd > pStart) || (eventStart === pStart);
      });
      
      // Find available column
      let column = 0;
      let maxColumns = 0;
      
      if (overlaps.length > 0) {
        // Find first available column
        const usedColumns = overlaps.map(o => o._column || 0);
        
        // Find the first unused column
        while (usedColumns.includes(column)) {
          column++;
        }
        
        // Calculate max columns including this event
        maxColumns = Math.max(...usedColumns) + 1;
      }
      
      // Assign column to event
      event._column = column;
      event._totalColumns = Math.max(maxColumns + 1, overlaps.length > 0 ? overlaps.length + 1 : 1);
      
      processed.push(event);
    });
    
    return dateEvents;
  };

  // Load events from JSON file
  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        console.log("Attempting to fetch events...");
        
        // Try with the public URL approach
        let response;
        try {
          response = await fetch('./data/events.json');
          console.log("Fetch response status:", response.status);
        } catch (fetchError) {
          console.error("First fetch attempt failed:", fetchError);
          // Try a fallback approach
          try {
            response = await fetch('/data/events.json');
            console.log("Fallback fetch response status:", response.status);
          } catch (fallbackError) {
            console.error("Fallback fetch attempt failed:", fallbackError);
            // Try one more approach - from root public folder
            try {
              response = await fetch('/events.json');
              console.log("Root public folder fetch response status:", response.status);
            } catch (rootFolderError) {
              console.error("Root public folder fetch attempt failed:", rootFolderError);
              throw new Error("All fetch attempts failed");
            }
          }
        }
        
        if (!response.ok) {
          console.error("Fetch response not OK:", response.status, response.statusText);
          throw new Error(`Failed to load events data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Events data loaded successfully:", data.length, "events");
        
        // Transform dates to make sure today's date is used for demo purposes
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];
        const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
        
        const transformedData = data.map(event => {
          let newDate = event.date;
          
          // Replace static dates with relative dates for demo
          if (event.date === "2023-05-08") newDate = today;
          if (event.date === "2023-05-09") newDate = tomorrow;
          if (event.date === "2023-05-07") newDate = yesterday;
          
          return {
            ...event,
            date: newDate
          };
        });
        
        setEvents(transformedData);
        setError(null);
      } catch (err) {
        console.error('Error loading events:', err);
        setError(`Failed to load events: ${err.message}. Please check the browser console for more details.`);
        
        // Fallback to some default events if loading fails
        const fallbackEvents = [
          {
            id: 1,
            date: now.toISOString().split('T')[0],
            startTime: "10:00",
            endTime: "11:30",
            color: "#4285f4",
            title: "Sample Event (Fallback)",
            location: "Error occurred loading events",
            hasVideoLink: false
          }
        ];
        setEvents(fallbackEvents);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEvents();
    
    // Update time indicator
    const interval = setInterval(() => {
      setTimeIndicatorOffset(getCurrentTimeOffset());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Load tasks from JSON file
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('./data/tasks.json');
        
        if (!response.ok) {
          throw new Error('Failed to load tasks data');
        }
        
        const data = await response.json();
        
        // Transform dates similar to events
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];
        const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
        
        const transformedData = data.map(task => {
          let newDueDate = task.dueDate;
          
          if (task.dueDate === "2023-05-08") newDueDate = today;
          if (task.dueDate === "2023-05-09") newDueDate = tomorrow;
          if (task.dueDate === "2023-05-07") newDueDate = yesterday;
          
          return {
            ...task,
            dueDate: newDueDate
          };
        });
        
        setTasks(transformedData);
      } catch (err) {
        console.error('Error loading tasks:', err);
      }
    };
    
    fetchTasks();
  }, []);

  // Navigation handlers
  const goToNextMonth = () => {
    const nextMonth = new Date(selectedDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setSelectedDate(nextMonth);
  };

  const goToPreviousMonth = () => {
    const prevMonth = new Date(selectedDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    setSelectedDate(prevMonth);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
  };

  const goToPreviousDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setSelectedDate(prevDay);
  };

  const selectDay = (day) => {
    if (day) {
      const newDate = new Date(selectedDate);
      newDate.setDate(day);
      setSelectedDate(newDate);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const toggleCategory = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedTags([]);
    setSearchQuery('');
  };

  const toggleTaskCompleted = (taskId) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const getFormattedDate = (date) => {
    return `${date.getDate()} ${months[date.getMonth()]}, ${daysOfWeek[date.getDay()]}`;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewEvent(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const toggleEventType = (isTask) => {
    setNewEvent(prev => ({
      ...prev,
      isTask
    }));
  };

  const handleTagSelection = (tag) => {
    setNewEvent(prev => {
      if (prev.tags.includes(tag)) {
        return {
          ...prev,
          tags: prev.tags.filter(t => t !== tag)
        };
      } else {
        return {
          ...prev,
          tags: [...prev.tags, tag]
        };
      }
    });
  };

  const saveNewItem = () => {
    if (!newEvent.title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (newEvent.isTask) {
      // Save as task
      const newTask = {
        id: tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
        title: newEvent.title,
        completed: false,
        category: newEvent.category || 'Personal',
        dueDate: newEvent.date
      };
      setTasks([...tasks, newTask]);
    } else {
      // Save as event using the new format
      const newEventObj = {
        id: events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1,
        title: newEvent.title,
        date: newEvent.date,
        startTime: newEvent.startTime,
        endTime: newEvent.endTime,
        color: newEvent.color,
        location: newEvent.location,
        hasVideoLink: newEvent.hasVideoLink
      };
      setEvents([...events, newEventObj]);
    }

    // Reset form and close modal
    setNewEvent({
      title: '',
      date: now.toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00',
      color: '#4285f4',
      location: '',
      hasVideoLink: false,
      isTask: false
    });
    setShowModal(false);
  };

  const filteredTasks = tasks.filter(task => {
    // Filter by category
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(task.category);
    
    // Filter by search query
    const matchesSearch = !searchQuery || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const filteredEvents = events.filter(event => {
    // Filter by search query
    const matchesSearch = !searchQuery || 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.location && event.location.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-blue-600">My Planner</h1>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-6 flex-1 justify-center">
          <div className="relative w-64">
            <input 
              type="text" 
              placeholder="Search events & tasks..." 
              className="pl-8 pr-2 py-1 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            <Search className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
          </div>
          
          <nav className="hidden md:flex space-x-4">
            <button className="flex items-center text-gray-600 hover:text-blue-600" onClick={() => setCurrentView('Month')}>
              <Calendar className="h-4 w-4 mr-1" />
              <span>Calendar</span>
            </button>
            <button className="flex items-center text-gray-600 hover:text-blue-600" onClick={() => setCurrentView('Agenda')}>
              <List className="h-4 w-4 mr-1" />
              <span>Agenda</span>
            </button>
            <button className="flex items-center text-gray-600">
              <Settings className="h-4 w-4 mr-1" />
              <span>Settings</span>
            </button>
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="relative">
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">2</span>
          </button>
          <button className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
          </button>
        </div>
      </header>

      {/* Main Toolbar */}
      <div className="bg-white px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-medium">{getFormattedDate(selectedDate)}</h2>
          <button 
            className="px-3 py-1 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-1 rounded hover:bg-gray-100" onClick={currentView === 'Month' ? goToPreviousMonth : goToPreviousDay}>
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button className="p-1 rounded hover:bg-gray-100" onClick={currentView === 'Month' ? goToNextMonth : goToNextDay}>
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
          <div className="border-l border-gray-300 h-6 mx-2"></div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {['Day', 'Week', 'Month', 'Agenda'].map(view => (
              <button 
                key={view}
                className={`px-3 py-1 text-sm rounded-md ${currentView === view ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}
                onClick={() => setCurrentView(view)}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          {/* Mini Calendar */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">{months[selectedDate.getMonth()]} {selectedDate.getFullYear()}</h3>
              <div className="flex space-x-1">
                <button className="p-1 rounded hover:bg-gray-100" onClick={goToPreviousMonth}>
                  <ChevronLeft className="h-3 w-3 text-gray-600" />
                </button>
                <button className="p-1 rounded hover:bg-gray-100" onClick={goToNextMonth}>
                  <ChevronRight className="h-3 w-3 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
              {daysOfWeek.map(day => (
                <div key={day} className="text-gray-500">{day[0]}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {generateMonthDays(selectedDate.getFullYear(), selectedDate.getMonth()).map((day, i) => (
                <button 
                  key={i}
                  className={`h-6 w-6 flex items-center justify-center text-xs rounded-full
                    ${!day ? 'invisible' : ''}
                    ${day === selectedDate.getDate() ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
                  disabled={!day}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* To-Do list & Filters */}
          <div className="p-4 border-b border-gray-200 flex-1 overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Tasks</h3>
              <button className="text-xs text-blue-600 hover:underline" onClick={clearAllFilters}>
                Clear all filters
              </button>
            </div>
            
            {/* Category filters */}
            <div className="mb-4">
              <h4 className="text-xs text-gray-500 mb-1">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <button
                    key={category}
                    className={`px-2 py-1 rounded-full text-xs 
                      ${selectedCategories.includes(category) 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => toggleCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Tags */}
            <div className="mb-4">
              <h4 className="text-xs text-gray-500 mb-1">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    className={`px-2 py-1 rounded-full text-xs
                      ${selectedTags.includes(tag) 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Task list */}
            <div>
              <h4 className="text-xs text-gray-500 mb-2">Todo List</h4>
              {filteredTasks.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No tasks found</p>
              ) : (
                <ul className="space-y-2">
                  {filteredTasks.map(task => (
                    <li key={task.id} className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={task.completed} 
                        onChange={() => toggleTaskCompleted(task.id)}
                        className="mr-2 h-4 w-4 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {task.title}
                      </span>
                      <span className="ml-auto text-xs text-gray-500">
                        {task.category}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>

        {/* Main Schedule Grid */}
        <div className="flex-1 overflow-y-auto relative">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          )}
          
          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-500">{error}</div>
            </div>
          )}
          
          {!isLoading && !error && (
            <>
              {currentView === 'Day' && (
                <div className="flex h-full">
                  {/* Time column */}
                  <div className="w-16 bg-white border-r border-gray-200 pt-4">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <div key={i} className="h-60 border-b border-gray-100 text-xs text-gray-500 px-2">
                        {i + 7}:00
                      </div>
                    ))}
                  </div>
                  
                  {/* Event grid */}
                  <div className="flex-1 relative">
                    {/* Time indicator */}
                    <div 
                      className="absolute left-0 right-0 border-t-2 border-red-500 z-10 flex items-center"
                      style={{ top: `${(timeIndicatorOffset / 60) * 60}px` }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 -mt-1"></div>
                    </div>
                    
                    {/* Time grid */}
                    {Array.from({ length: 14 }).map((_, i) => (
                      <div key={i} className="h-60 border-b border-gray-100"></div>
                    ))}
                    
                    {/* Events */}
                    {detectOverlaps(filteredEvents, selectedDate)
                      .map(event => {
                        // Calculate event position and height
                        const startHour = parseInt(event.startTime.split(':')[0]);
                        const startMinute = parseInt(event.startTime.split(':')[1]);
                        const endHour = parseInt(event.endTime.split(':')[0]);
                        const endMinute = parseInt(event.endTime.split(':')[1]);
                        
                        const startOffset = ((startHour - 7) * 60 + startMinute) * 1;
                        const duration = ((endHour - startHour) * 60 + (endMinute - startMinute)) * 1;
                        
                        // Calculate column width based on overlapping events
                        const columnWidth = 100 / event._totalColumns;
                        const leftPosition = 4 + (event._column * columnWidth);
                        const rightPosition = 100 - (leftPosition + columnWidth) + 4;
                        
                        return (
                          <div
                            key={event.id}
                            className="absolute p-2 rounded-md border shadow-sm"
                            style={{ 
                              top: `${startOffset}px`,
                              height: `${duration}px`,
                              backgroundColor: `${event.color}20`,
                              borderColor: event.color,
                              left: `${leftPosition}%`,
                              right: `${rightPosition}%`,
                              zIndex: event._column + 10
                            }}
                          >
                            <div className="font-medium text-gray-800 truncate">{event.title}</div>
                            <div className="flex items-center text-xs text-gray-600 mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>{event.startTime} - {event.endTime}</span>
                              
                              {event.location && (
                                <div className="flex items-center ml-2">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              )}
                              
                              {event.hasVideoLink && (
                                <div className="flex items-center ml-2">
                                  <Video className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {currentView === 'Week' && (
                <div className="flex-1 h-full flex flex-col">
                  {/* Week header */}
                  <div className="flex border-b border-gray-200">
                    <div className="w-16"></div>
                    {Array.from({ length: 7 }).map((_, i) => {
                      const day = new Date(selectedDate);
                      day.setDate(selectedDate.getDate() - selectedDate.getDay() + i);
                      const isToday = day.toDateString() === new Date().toDateString();
                      const isSelected = day.toDateString() === selectedDate.toDateString();
                      
                      return (
                        <div 
                          key={i} 
                          className={`flex-1 py-2 text-center cursor-pointer
                            ${isToday ? 'bg-blue-50' : ''}
                            ${isSelected ? 'text-blue-600 font-semibold' : ''}
                          `}
                          onClick={() => setSelectedDate(new Date(day))}
                        >
                          <div className="text-xs text-gray-500">{daysOfWeek[day.getDay()]}</div>
                          <div className={`text-sm mt-1 ${isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto' : ''}`}>
                            {day.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Week body */}
                  <div className="flex-1 flex overflow-y-auto">
                    {/* Time column */}
                    <div className="w-16 bg-white border-r border-gray-200 flex flex-col pt-4">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <div key={i} className="h-20 border-b border-gray-100 text-xs text-gray-500 px-2">
                          {i + 7}:00
                        </div>
                      ))}
                    </div>
                    
                    {/* Days columns */}
                    <div className="flex-1 relative">
                      {/* Time indicator */}
                      <div 
                        className="absolute left-0 right-0 border-t-2 border-red-500 z-10 flex items-center"
                        style={{ top: `${(timeIndicatorOffset / 60) * 20}px` }}
                      >
                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 -mt-1"></div>
                      </div>
                      
                      {/* Time grid */}
                      <div className="flex h-full">
                        {Array.from({ length: 7 }).map((_, dayIndex) => {
                          const currentDay = new Date(selectedDate);
                          currentDay.setDate(selectedDate.getDate() - selectedDate.getDay() + dayIndex);
                          const currentDayStr = currentDay.toISOString().split('T')[0];
                          
                          return (
                            <div key={dayIndex} className="flex-1 border-r border-gray-200 relative">
                              {Array.from({ length: 14 }).map((_, i) => (
                                <div key={i} className="h-20 border-b border-gray-100"></div>
                              ))}
                              
                              {/* Events for this day */}
                              {(() => {
                                const dayEvents = detectOverlaps(filteredEvents.filter(event => event.date === currentDayStr), currentDay);
                                
                                return dayEvents.map(event => {
                                  // Calculate event position and height
                                  const startHour = parseInt(event.startTime.split(':')[0]);
                                  const startMinute = parseInt(event.startTime.split(':')[1]);
                                  const endHour = parseInt(event.endTime.split(':')[0]);
                                  const endMinute = parseInt(event.endTime.split(':')[1]);
                                  
                                  const startOffset = ((startHour - 7) * 60 + startMinute) * (20/60);
                                  const duration = ((endHour - startHour) * 60 + (endMinute - startMinute)) * (20/60);
                                  
                                  // Calculate column width based on overlapping events
                                  const columnWidth = 100 / event._totalColumns;
                                  const leftPosition = 1 + (event._column * columnWidth);
                                  const rightPosition = 100 - (leftPosition + columnWidth) + 1;
                                  
                                  return (
                                    <div
                                      key={event.id}
                                      className={`absolute p-1 rounded-md border shadow-sm overflow-hidden`}
                                      style={{ 
                                        top: `${startOffset}px`,
                                        height: `${duration}px`,
                                        backgroundColor: `${event.color}20`,
                                        borderColor: event.color,
                                        left: `${leftPosition}%`,
                                        right: `${rightPosition}%`,
                                        zIndex: event._column + 10
                                      }}
                                    >
                                      <div className="font-medium text-xs truncate" style={{ color: event.color }}>
                                        {event.title}
                                      </div>
                                      <div className="flex items-center text-xs text-gray-600 mt-1">
                                        <Clock className="h-3 w-3 mr-1" />
                                        <span>{event.startTime}</span>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentView === 'Month' && (
                <div className="flex-1 p-4">
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {daysOfWeek.map(day => (
                      <div key={day} className="text-sm font-medium text-gray-500 py-2">{day}</div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 grid-rows-6 gap-1 h-[calc(100%-2rem)]">
                    {(() => {
                      // Calculate days for the month view
                      const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
                      const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
                      const daysArray = [];
                      
                      // Previous month days
                      for (let i = 0; i < firstDayOfMonth; i++) {
                        const prevDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0 - (firstDayOfMonth - i - 1));
                        daysArray.push({
                          date: prevDate,
                          isCurrentMonth: false,
                          dateStr: prevDate.toISOString().split('T')[0]
                        });
                      }
                      
                      // Current month days
                      for (let i = 1; i <= daysInMonth; i++) {
                        const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i);
                        daysArray.push({
                          date,
                          isCurrentMonth: true,
                          dateStr: date.toISOString().split('T')[0]
                        });
                      }
                      
                      // Next month days to fill the grid (up to 42 cells)
                      const remainingCells = 42 - daysArray.length;
                      for (let i = 1; i <= remainingCells; i++) {
                        const nextDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, i);
                        daysArray.push({
                          date: nextDate,
                          isCurrentMonth: false,
                          dateStr: nextDate.toISOString().split('T')[0]
                        });
                      }
                      
                      return daysArray.map((day, index) => {
                        const isToday = day.date.toDateString() === new Date().toDateString();
                        const isSelected = day.date.toDateString() === selectedDate.toDateString();
                        const dayEvents = filteredEvents.filter(event => event.date === day.dateStr);
                        
                        return (
                          <div 
                            key={index}
                            className={`border rounded flex flex-col min-h-[100px] h-full relative p-1 ${
                              day.isCurrentMonth 
                                ? 'bg-white' 
                                : 'bg-gray-50 text-gray-400'
                            } ${
                              isToday ? 'border-blue-500' : 'border-gray-200'
                            } ${
                              isSelected ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                            }`}
                            onClick={() => setSelectedDate(new Date(day.date))}
                          >
                            <div className={`text-right text-sm font-medium ${isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center ml-auto' : ''}`}>
                              {day.date.getDate()}
                            </div>
                            
                            <div className="mt-1 space-y-1 overflow-y-auto flex-1">
                              {dayEvents.slice(0, 3).map(event => (
                                <div 
                                  key={event.id} 
                                  className="text-xs p-1 rounded truncate flex items-center"
                                  style={{ backgroundColor: `${event.color}20` }}
                                >
                                  <div 
                                    className="w-2 h-2 rounded-full mr-1 flex-shrink-0" 
                                    style={{ backgroundColor: event.color }}
                                  ></div>
                                  <span style={{ color: event.color.replace('20', '') }}>{event.title}</span>
                                </div>
                              ))}
                              
                              {dayEvents.length > 3 && (
                                <div className="text-xs text-gray-500 pl-1">+{dayEvents.length - 3} more</div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {currentView === 'Agenda' && (
                <div className="p-6">
                  <h3 className="text-lg font-medium mb-4">Agenda View</h3>
                  
                  {filteredEvents.length === 0 ? (
                    <p className="text-gray-500 italic">No events found</p>
                  ) : (
                    <div className="space-y-4">
                      {filteredEvents.map(event => {
                        return (
                          <div 
                            key={event.id} 
                            className={`p-3 rounded-md border shadow-sm`}
                            style={{ 
                              backgroundColor: `${event.color}10`,
                              borderColor: event.color
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium" style={{ color: event.color }}>{event.title}</h4>
                                <div className="text-sm text-gray-600 mt-1">
                                  {new Date(event.date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                  , {event.startTime} - {event.endTime}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap mt-2 gap-2">
                              {event.location && (
                                <div className="flex items-center text-xs text-gray-600">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  <span>{event.location}</span>
                                </div>
                              )}
                              
                              {event.hasVideoLink && (
                                <div className="flex items-center text-xs text-gray-600">
                                  <Video className="h-3 w-3 mr-1" />
                                  <span>Video conference</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Add Button */}
      <button 
        className="absolute bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 shadow-lg"
        onClick={() => setShowModal(true)}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Create Item Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create New Item</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input 
                  type="text" 
                  name="title"
                  value={newEvent.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter title" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex space-x-2">
                  <button 
                    className={`flex-1 py-2 rounded-md ${!newEvent.isTask ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    onClick={() => toggleEventType(false)}
                  >
                    Event
                  </button>
                  <button 
                    className={`flex-1 py-2 rounded-md ${newEvent.isTask ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    onClick={() => toggleEventType(true)}
                  >
                    Task
                  </button>
                </div>
              </div>
              
              {newEvent.isTask && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(category => (
                      <button
                        key={category}
                        className={`px-2 py-1 rounded-full text-xs 
                          ${selectedCategories.includes(category) 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        onClick={() => toggleCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input 
                  type="date" 
                  name="date"
                  value={newEvent.date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              {newEvent.isTask && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input 
                    type="date" 
                    name="dueDate"
                    value={newEvent.dueDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input 
                  type="time" 
                  name="startTime"
                  value={newEvent.startTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input 
                  type="time" 
                  name="endTime"
                  value={newEvent.endTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex space-x-2">
                  {eventColors.map(color => (
                    <button
                      key={color}
                      className={`w-6 h-6 rounded-full ${newEvent.color === color ? 'border-2 border-blue-500' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewEvent(prev => ({ ...prev, color }))}
                    ></button>
                  ))}
                </div>
              </div>
              
              {newEvent.isTask && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                      <button
                        key={tag}
                        className={`px-2 py-1 rounded-full text-xs
                          ${selectedTags.includes(tag) 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        onClick={() => handleTagSelection(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input 
                  type="text" 
                  name="location"
                  value={newEvent.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video Link</label>
                <input 
                  type="text" 
                  name="hasVideoLink"
                  value={newEvent.hasVideoLink ? 'Yes' : 'No'}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            <div className="mt-4">
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                onClick={saveNewItem}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;