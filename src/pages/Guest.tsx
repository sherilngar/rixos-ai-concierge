import { useEffect } from 'react';
import { GuestApp } from '../components/guest/GuestApp';

export default function Guest() {
  useEffect(() => {
    document.title = 'Concierge · Rixos Bab Al Bahr';
  }, []);
  return (
    <div className="min-h-[100dvh] bg-sand/60 dark:bg-bg">
      <GuestApp />
    </div>
  );
}
