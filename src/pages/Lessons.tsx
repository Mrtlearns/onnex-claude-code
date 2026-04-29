import { Navigate } from "react-router-dom";
import { useOS } from "@/context/OSContext";
import { LessonIndex } from "@/components/LessonIndex";

const Lessons = () => {
  const { os } = useOS();
  if (!os) return <Navigate to="/" replace />;
  return <LessonIndex />;
};

export default Lessons;
