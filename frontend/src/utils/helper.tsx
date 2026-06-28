 export const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };


  export const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: '2-digit',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  export function formatDateWithRelativeTime(isoDateStr: string) {
  const date = new Date(isoDateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Format to '16 July'
  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
  }).format(date);

  // Calculate time ago
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let timeAgo;
  if (seconds < 60) {
    timeAgo = 'Just now';
  } else if (minutes < 60) {
    timeAgo = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    timeAgo = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (days < 30) {
    timeAgo = `${days} day${days !== 1 ? 's' : ''} ago`;
  } else {
    const months = Math.floor(days / 30);
    timeAgo = `${months} month${months !== 1 ? 's' : ''} ago`;
  }

  return `${formattedDate} (${timeAgo})`;
}



  
  export const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    } catch {
      return 'Unknown';
    }
  };
