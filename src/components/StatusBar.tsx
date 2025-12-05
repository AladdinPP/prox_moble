export const StatusBar = () => {
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <div className="flex justify-between items-center px-6 py-2 text-sm font-medium text-foreground">
      <div className="flex items-center space-x-1">
        <span>{currentTime}</span>
      </div>
      <div className="flex items-center space-x-1">
        <div className="flex space-x-1">
          <div className="w-1 h-1 bg-foreground rounded-full opacity-60"></div>
          <div className="w-1 h-1 bg-foreground rounded-full opacity-80"></div>
          <div className="w-1 h-1 bg-foreground rounded-full"></div>
        </div>
        <span className="ml-2">📶</span>
        <span>🔋</span>
      </div>
    </div>
  );
};