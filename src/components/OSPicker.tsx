import { Apple, Monitor, Terminal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOS, type OS, OS_LABELS } from "@/context/OSContext";
import { BRAND } from "@/lib/brand";

const options: { id: OS; Icon: typeof Apple }[] = [
  { id: "mac", Icon: Apple },
  { id: "windows", Icon: Monitor },
  { id: "linux", Icon: Terminal },
];

export const OSPicker = () => {
  const { setOS } = useOS();
  const navigate = useNavigate();

  const choose = (id: OS) => {
    setOS(id);
    navigate("/lessons");
  };

  return (
    <main className="min-h-svh flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-3xl text-center">
        <p className="text-accent text-sm font-medium tracking-wide mb-4">
          {BRAND.name.toUpperCase()}
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-foreground mb-4">
          What system are you on?
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto mb-12">
          We'll tailor commands and instructions to your operating system. You can switch anytime.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {options.map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => choose(id)}
              className="group rounded-2xl bg-card border border-border p-8 hover:border-accent hover:shadow-card transition-all"
            >
              <div className="mx-auto mb-4 h-14 w-14 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-accent-soft transition-colors">
                <Icon className="h-7 w-7 text-foreground group-hover:text-accent" strokeWidth={1.75} />
              </div>
              <div className="font-serif font-bold text-lg text-foreground">{OS_LABELS[id]}</div>
            </button>
          ))}
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          You can switch anytime using the toggle in the top corner.
        </p>
      </div>
    </main>
  );
};
