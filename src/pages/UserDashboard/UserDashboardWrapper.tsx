// src/pages/UserDashboard/UserDashboardWrapper.tsx
/**
 * Обёртка для переключения между старой и новой версией dashboard
 */
import UserDashboard from './UserDashboard';

export default function UserDashboardWrapper() {
  // Возвращаем старую рабочую версию
  return <UserDashboard />;
}
