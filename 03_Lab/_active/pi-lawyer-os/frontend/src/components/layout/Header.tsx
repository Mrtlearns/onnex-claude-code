import { ChevronDown, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/useAuth';
import { getUser } from '@/lib/auth';

export default function Header() {
  const { data: currentUser } = useCurrentUser();
  const logout = useLogout();

  // Fall back to localStorage while the query is in-flight
  const user = currentUser ?? getUser();
  const firmName = user?.firm_name ?? 'PI Lawyer OS';
  const userName = user?.name ?? 'Unknown User';
  const userEmail = user?.email ?? '';

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-gray-200 shrink-0">
      {/* Firm name */}
      <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">
        {firmName}
      </span>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-sm text-gray-700"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-medium text-xs shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:inline truncate max-w-[140px]">{userName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-gray-900 truncate">{userName}</span>
            <span className="text-xs font-normal text-gray-500 truncate">{userEmail}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
