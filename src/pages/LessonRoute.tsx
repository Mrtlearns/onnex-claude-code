import { Navigate } from "react-router-dom";
import { useOS } from "@/context/OSContext";
import { LessonPage } from "@/components/LessonPage";

const LessonRoute = () => {
  const { os } = useOS();
  if (!os) return <Navigate to="/" replace />;
  return <LessonPage />;
};

export default LessonRoute;
