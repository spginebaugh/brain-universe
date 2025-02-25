import { Node } from '@xyflow/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { FlowNodeData } from '../types/workspace-types';
import { useState, useCallback } from 'react';
import { GraphService } from '@/shared/services/firebase/graph-service';
import { toast } from 'sonner';
import { useGraphWorkspace } from '../hooks/use-graph-workspace';
import { TextSection } from '@/shared/types/node';
import { NodePosition } from '@/shared/types/node';
import { calculateRelativePosition } from '../utils/position-utils';

interface NodeInfoDialogProps {
  node: Node<FlowNodeData> | null;
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

type NodeHandlePosition = 'top' | 'right' | 'bottom' | 'left' | null;

const positionOptions: { value: NodeHandlePosition; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'right', label: 'Right' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
];

// Predefined color options for node backgrounds
const colorOptions = [
  { value: '#ffffff', label: 'White' },
  { value: '#e0f2e9', label: 'Green (Root)' },
  { value: '#f0f4ff', label: 'Light Blue' },
  { value: '#fff4e6', label: 'Light Orange' },
  { value: '#f3f4f6', label: 'Light Gray' },
  { value: '#fdf2f8', label: 'Light Pink' },
  { value: '#ecfdf5', label: 'Mint' },
  { value: '#fffbeb', label: 'Light Yellow' },
];

export const NodeInfoDialog = ({ node, isOpen, onClose, userId }: NodeInfoDialogProps) => {
  const { refresh, graphs } = useGraphWorkspace(userId);
  const graphService = new GraphService(userId);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<FlowNodeData>(node?.data || {} as FlowNodeData);
  const [nodePosition, setNodePosition] = useState<NodePosition>({ x: 0, y: 0 });
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');

  const cleanup = useCallback(() => {
    setIsEditing(false);
    setEditedData(node?.data || {} as FlowNodeData);
    setNodePosition({ x: 0, y: 0 });
    // Reset background color
    setBackgroundColor(node?.style?.background as string || '#ffffff');
  }, [node]);

  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const handleSave = useCallback(async () => {
    if (!node) return;
    
    try {
      toast.loading('Saving changes...', { id: 'save-node' });
      
      // Create a copy of the metadata with the backgroundColor property
      const updatedMetadata = {
        ...editedData.metadata,
        backgroundColor: backgroundColor
      };
      
      // Update node data including position and background color
      await graphService.updateNode(editedData.graphId, node.id, {
        properties: editedData.properties,
        metadata: updatedMetadata,
        content: editedData.content,
        nodePosition: nodePosition
      });

      // If this is a root node and the title changed, update the graph name
      if (node.id === editedData.rootNodeId && editedData.properties.title !== node.data.properties.title) {
        await graphService.updateGraph(editedData.graphId, {
          graphName: editedData.properties.title
        });
      }

      await refresh();
      cleanup();
      toast.success('Changes saved successfully', { id: 'save-node' });
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast.error('Failed to save changes', { id: 'save-node' });
    }
  }, [editedData, graphService, node, refresh, nodePosition, backgroundColor, cleanup]);

  const handleEdit = useCallback(() => {
    if (!node) return;
    setEditedData(node.data);
    
    // Get the current graph
    const graph = graphs.find(g => g.graphId === node.data.graphId);
    if (!graph) return;

    // Calculate relative position from the node's current position
    const relativePosition = calculateRelativePosition(node.position, graph.graphPosition);
    setNodePosition(relativePosition);
    
    // Set the current background color
    setBackgroundColor(
      (node.style?.background as string) || 
      (node.data.metadata.backgroundColor as string) || 
      (node.id === graph.rootNodeId ? '#e0f2e9' : '#ffffff')
    );
    
    setIsEditing(true);
  }, [node, graphs]);

  const handleCancel = useCallback(() => {
    if (!node) return;
    cleanup();
  }, [node, cleanup]);

  const handleInputChange = useCallback((
    section: 'properties' | 'metadata' | 'content',
    field: string,
    value: string | Record<string, TextSection> | NodeHandlePosition
  ) => {
    setEditedData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  }, []);

  const handlePositionChange = useCallback((axis: 'x' | 'y', value: string) => {
    const numValue = parseFloat(value) || 0;
    setNodePosition(prev => ({
      ...prev,
      [axis]: numValue
    }));
  }, []);

  const handleColorChange = useCallback((color: string) => {
    setBackgroundColor(color);
  }, []);

  if (!node) return null;

  const { properties, metadata, content, progress } = isEditing ? editedData : node.data;
  
  // Check if this is a root node
  const isRootNode = node.id === node.data.rootNodeId;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl font-bold overflow-hidden text-ellipsis">
              {isEditing ? (
                <Input
                  value={properties.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    handleInputChange('properties', 'title', e.target.value)
                  }
                  className="text-xl font-bold w-full"
                  placeholder="Node Title"
                />
              ) : (
                <span className="line-clamp-2 block">{properties.title}</span>
              )}
            </DialogTitle>
            <div className="flex-shrink-0">
              {!isEditing ? (
                <Button onClick={handleEdit} size="sm" variant="outline">
                  Edit
                </Button>
              ) : (
                <Button onClick={handleSave} size="sm">
                  Save Changes
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="flex-grow relative">
          <ScrollArea className="absolute inset-0 pr-4">
            <div className="space-y-6 pb-8">
              {/* Basic Information */}
              <section>
                <h3 className="text-lg font-semibold mb-2">Basic Information</h3>
                <div className="space-y-4">
                  {isEditing ? (
                    <>
                      <Textarea
                        value={properties.description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                          handleInputChange('properties', 'description', e.target.value)
                        }
                        placeholder="Description"
                        className="min-h-[120px]"
                      />
                      
                      {/* Background Color Selection */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-500">Background Color</label>
                        <div className="flex flex-wrap gap-2">
                          {colorOptions.map((color) => (
                            <div 
                              key={color.value}
                              className={`w-8 h-8 rounded-md cursor-pointer border-2 ${
                                backgroundColor === color.value ? 'border-blue-500' : 'border-gray-200'
                              }`}
                              style={{ backgroundColor: color.value }}
                              onClick={() => handleColorChange(color.value)}
                              title={color.label}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div 
                            className="w-8 h-8 rounded-md border border-gray-300"
                            style={{ backgroundColor: backgroundColor }}
                          />
                          <Input
                            type="text"
                            value={backgroundColor}
                            onChange={(e) => handleColorChange(e.target.value)}
                            className="w-32"
                            placeholder="#RRGGBB"
                          />
                          <span className="text-sm text-gray-500">
                            {isRootNode && backgroundColor !== '#e0f2e9' && 
                              "(Note: Changing a root node's color may affect visibility)"}
                          </span>
                        </div>
                      </div>
                      
                      {/* Position controls - changed from 2 columns to 1 column for more space */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm text-gray-500">Source Position</label>
                          <Select
                            value={properties.sourcePosition ?? 'top'}
                            onValueChange={(value: string) => 
                              handleInputChange('properties', 'sourcePosition', value === '' ? 'top' : value as NodeHandlePosition)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select source position" />
                            </SelectTrigger>
                            <SelectContent>
                              {positionOptions.map((option) => (
                                <SelectItem key={option.label} value={option.value ?? ''}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm text-gray-500">Target Position</label>
                          <Select
                            value={properties.targetPosition ?? 'bottom'}
                            onValueChange={(value: string) => 
                              handleInputChange('properties', 'targetPosition', value === '' ? 'bottom' : value as NodeHandlePosition)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select target position" />
                            </SelectTrigger>
                            <SelectContent>
                              {positionOptions.map((option) => (
                                <SelectItem key={option.label} value={option.value ?? ''}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Coordinate inputs - changed from 2 columns to 1 column for more space */}
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <label className="text-sm text-gray-500">X Position (relative to graph)</label>
                          <Input
                            type="number"
                            value={nodePosition.x}
                            onChange={(e) => handlePositionChange('x', e.target.value)}
                            placeholder="X coordinate"
                            className="w-full"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm text-gray-500">Y Position (relative to graph)</label>
                          <Input
                            type="number"
                            value={nodePosition.y}
                            onChange={(e) => handlePositionChange('y', e.target.value)}
                            placeholder="Y coordinate"
                            className="w-full"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 text-base">{properties.description}</p>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline">{properties.type}</Badge>
                        <Badge 
                          variant="outline" 
                          className={metadata.status === 'completed' ? 'bg-green-100' : ''}
                        >
                          {metadata.status}
                        </Badge>
                        {properties.sourcePosition && (
                          <Badge variant="outline">Source: {properties.sourcePosition}</Badge>
                        )}
                        {properties.targetPosition && (
                          <Badge variant="outline">Target: {properties.targetPosition}</Badge>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Tags and Prerequisites */}
              {((metadata.tags && metadata.tags.length > 0) || (metadata.prerequisites && metadata.prerequisites.length > 0)) && (
                <section>
                  <h3 className="text-lg font-semibold mb-2">Tags & Prerequisites</h3>
                  <div className="space-y-2">
                    {metadata.tags && metadata.tags.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Tags:</p>
                        <div className="flex gap-2 flex-wrap">
                          {metadata.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {metadata.prerequisites && metadata.prerequisites.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Prerequisites:</p>
                        <div className="flex gap-2 flex-wrap">
                          {metadata.prerequisites.map((prereq) => (
                            <Badge key={prereq} variant="secondary">{prereq}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Progress Information */}
              {progress && (
                <section>
                  <h3 className="text-lg font-semibold mb-2">Progress</h3>
                  <div className="space-y-2">
                    {progress.score !== undefined && (
                      <p>Score: {progress.score}</p>
                    )}
                    {progress.attempts !== undefined && (
                      <p>Attempts: {progress.attempts}</p>
                    )}
                    {progress.lastAttempt && (
                      <p>Last Attempt: {progress.lastAttempt.toDate().toLocaleString()}</p>
                    )}
                  </div>
                </section>
              )}

              {/* Content */}
              <section>
                <h3 className="text-lg font-semibold mb-2">Content</h3>
                <div className="space-y-4">
                  {isEditing ? (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Main Text:</p>
                      <Textarea
                        value={(content.mainText as string) || (content.text as string) || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                          handleInputChange('content', 'mainText', e.target.value)
                        }
                        placeholder="Main content text"
                        className="min-h-[250px]"
                      />
                    </div>
                  ) : (
                    <>
                      {((content.mainText as string) || (content.text as string)) && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Main Text:</p>
                          <p className="whitespace-pre-wrap text-base">{(content.mainText as string) || (content.text as string)}</p>
                        </div>
                      )}
                    </>
                  )}

                  {content.sections && Object.entries(content.sections).length > 0 && (
                    <div className="space-y-4">
                      {Object.entries(content.sections).map(([id, section]) => (
                        <div key={id}>
                          {isEditing ? (
                            <>
                              <Input
                                value={section.title}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const newSections = { ...content.sections };
                                  newSections[id] = {
                                    ...section,
                                    title: e.target.value
                                  };
                                  handleInputChange('content', 'sections', newSections);
                                }}
                                className="mb-2"
                                placeholder="Section Title"
                              />
                              <Textarea
                                value={section.content}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                  const newSections = { ...content.sections };
                                  newSections[id] = {
                                    ...section,
                                    content: e.target.value
                                  };
                                  handleInputChange('content', 'sections', newSections);
                                }}
                                placeholder="Section content"
                                className="min-h-[120px]"
                              />
                            </>
                          ) : (
                            <>
                              <h4 className="font-medium mb-1">{section.title}</h4>
                              <p className="whitespace-pre-wrap text-base">{section.content}</p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {content.videoUrl && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Video URL:</p>
                      {isEditing ? (
                        <Input
                          value={content.videoUrl}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                            handleInputChange('content', 'videoUrl', e.target.value)
                          }
                          placeholder="Video URL"
                        />
                      ) : (
                        <a 
                          href={content.videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {content.videoUrl}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Questions section remains read-only for now */}
                  {content.questions && content.questions.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Questions:</p>
                      <div className="space-y-4">
                        {content.questions.map((question, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <p className="font-medium mb-2">{question.prompt}</p>
                            {question.options && (
                              <ul className="list-disc list-inside space-y-1 mb-2">
                                {question.options.map((option, optIndex) => (
                                  <li key={optIndex} className={option === question.correctAnswer ? 'text-green-600 font-medium' : ''}>
                                    {option}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {question.explanation && (
                              <p className="text-sm text-gray-600 mt-2">
                                <span className="font-medium">Explanation: </span>
                                {question.explanation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>
        <DialogFooter className="flex-shrink-0 mt-4 pt-2 border-t">
          <div className="flex justify-end gap-2">
            {isEditing && (
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 