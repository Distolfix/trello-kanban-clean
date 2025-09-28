import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { useDatabaseTheme } from "@/hooks/useDatabaseTheme";

export function ThemeToggle() {
  const { theme, setTheme } = useDatabaseTheme();

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-8 w-8"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span className="sr-only">
        {theme === 'dark' ? 'Attiva modalità chiara' : 'Attiva modalità scura'}
      </span>
    </Button>
  );
}