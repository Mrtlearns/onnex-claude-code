import { Navigate } from "react-router-dom";
import { useOS } from "@/context/OSContext";
import { useAdmin } from "@/context/AdminContext";
import { AdminEditor } from "@/components/AdminEditor";

const Admin = () => {
  const { os } = useOS();
  const { admin } = useAdmin();
  if (!os) return <Navigate to="/" replace />;
  if (!admin) return <Navigate to="/lessons" replace />;
  return <AdminEditor />;
};

export default Admin;
