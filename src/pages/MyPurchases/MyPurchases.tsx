// Legacy public route — redirect to dashboard library.
import { Navigate } from 'react-router-dom';

export default function MyPurchases() {
  return <Navigate to="/dashboard-new/my-purchases" replace />;
}
