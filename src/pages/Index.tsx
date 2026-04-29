import { Navigate } from "react-router-dom";
import { useOS } from "@/context/OSContext";
import { OSPicker } from "@/components/OSPicker";

const Index = () => {
  const { os } = useOS();
  if (os) return <Navigate to="/lessons" replace />;
  return <OSPicker />;
};

export default Index;
