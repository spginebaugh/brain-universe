'use client';

import { Network, ShoppingCart, Plus, PlusSquare, ArrowRightCircle, Palette, UserCircle, LogOut } from 'lucide-react';
import { useTemplateGraphs } from '@/features/side-bar/hooks/use-template-graphs';
import { useShopStore } from '@/features/shop-panel/stores/shop-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { TemplateGraph } from '@/shared/types/template-types';
import { useTemplateSelectionStore } from '../stores/template-selection-store';
import { useRootNodeCreationStore } from '../stores/root-node-creation-store';
import { useNodeCreationStore } from '../stores/node-creation-store';
import { useEdgeCreationStore } from '../stores/edge-creation-store';
import { useNodeSelectionStore } from '../stores/node-selection-store';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useRouter } from 'next/navigation';

interface SideBarProps {
  className?: string;
}

export const SideBar = ({ className = '' }: SideBarProps) => {
  const { data: templates, isLoading } = useTemplateGraphs();
  const { toggleShop } = useShopStore();
  const { setSelectedTemplate } = useTemplateSelectionStore();
  const { setCreationMode: setRootNodeCreationMode } = useRootNodeCreationStore();
  const { setCreationMode: setNodeCreationMode } = useNodeCreationStore();
  const { setCreationMode: setEdgeCreationMode } = useEdgeCreationStore();
  const { selectedNodes, isMultiEditMode, setMultiEditMode } = useNodeSelectionStore();
  const { signOut, user } = useAuth();
  const router = useRouter();

  const handleMultiEditClick = () => {
    setMultiEditMode(!isMultiEditMode);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/sign-in');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <div 
      className={`w-16 h-screen bg-gray-900 fixed left-0 top-0 flex flex-col items-center gap-4 py-4 ${className}`}
    >
      <button
        onClick={() => setRootNodeCreationMode(true)}
        className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        title="Create New Root Node"
      >
        <Plus className="w-6 h-6" />
      </button>

      <button
        onClick={() => setNodeCreationMode(true)}
        className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        title="Add New Node"
      >
        <PlusSquare className="w-6 h-6" />
      </button>

      <button
        onClick={() => setEdgeCreationMode(true)}
        className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        title="Add New Edge"
      >
        <ArrowRightCircle className="w-6 h-6" />
      </button>

      <button
        onClick={handleMultiEditClick}
        disabled={selectedNodes.length <= 1}
        className={`w-10 h-10 rounded-lg ${
          isMultiEditMode 
            ? 'bg-blue-600 text-white' 
            : selectedNodes.length > 1 
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white' 
              : 'bg-gray-800 opacity-50 cursor-not-allowed text-gray-500'
        } flex items-center justify-center transition-colors relative`}
        title="Edit Multiple Nodes"
      >
        <Palette className="w-6 h-6" />
        {selectedNodes.length > 1 && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {selectedNodes.length}
          </span>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            title="Add Graph Template"
          >
            <Network className="w-6 h-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <DropdownMenuItem disabled>
              Loading templates...
            </DropdownMenuItem>
          ) : templates?.map((template: TemplateGraph) => (
            <DropdownMenuItem
              key={template.graphId}
              onClick={() => setSelectedTemplate(template.graphId)}
              className="flex flex-col items-start gap-1"
            >
              <span className="font-medium">{template.graphName}</span>
              <span className="text-sm text-gray-500">{template.properties.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={toggleShop}
        className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        title="Shop"
      >
        <ShoppingCart className="w-6 h-6" />
      </button>

      {/* Spacer to push profile to bottom */}
      <div className="flex-grow"></div>

      {/* Profile dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            title="Profile"
          >
            <UserCircle className="w-6 h-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {user && (
            <>
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.displayName || user.email}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:text-red-500 cursor-pointer">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default SideBar; 