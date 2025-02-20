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

interface NodeInfoDialogProps {
  node: Node<FlowNodeData> | null;
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

type NodePosition = 'top' | 'right' | 'bottom' | 'left' | null;

const positionOptions: { value: NodePosition; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'right', label: 'Right' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
];

export const NodeInfoDialog = ({ node, isOpen, onClose, userId }: NodeInfoDialogProps) => {
  const { refresh } = useGraphWorkspace(userId);
  const graphService = new GraphService(userId);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<FlowNodeData>(node?.data || {} as FlowNodeData);

  const handleSave = useCallback(async () => {
    if (!node) return;
    
    try {
      toast.loading('Saving changes...', { id: 'save-node' });
      
      // Update node data
      await graphService.updateNode(editedData.graphId, node.id, {
        properties: editedData.properties,
        metadata: editedData.metadata,
        content: editedData.content
      });

      // If this is a root node and the title changed, update the graph name
      if (node.id === editedData.rootNodeId && editedData.properties.title !== node.data.properties.title) {
        await graphService.updateGraph(editedData.graphId, {
          graphName: editedData.properties.title
        });
      }

      await refresh();
      setIsEditing(false);
      toast.success('Changes saved successfully', { id: 'save-node' });
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast.error('Failed to save changes', { id: 'save-node' });
    }
  }, [editedData, graphService, node, refresh]);

  const handleEdit = useCallback(() => {
    if (!node) return;
    setEditedData(node.data);
    setIsEditing(true);
  }, [node]);

  const handleCancel = useCallback(() => {
    if (!node) return;
    setIsEditing(false);
    setEditedData(node.data);
  }, [node]);

  const handleInputChange = useCallback((
    section: 'properties' | 'metadata' | 'content',
    field: string,
    value: string | Record<string, TextSection> | NodePosition
  ) => {
    setEditedData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  }, []);

  if (!node) return null;

  const { properties, metadata, content, progress } = isEditing ? editedData : node.data;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isEditing ? (
              <Input
                value={properties.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  handleInputChange('properties', 'title', e.target.value)
                }
                className="text-xl font-bold"
                placeholder="Node Title"
              />
            ) : (
              properties.title
            )}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="mt-4 pr-4">
          <div className="space-y-6">
            {/* Basic Information */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Basic Information</h3>
              <div className="space-y-2">
                {isEditing ? (
                  <>
                    <Textarea
                      value={properties.description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                        handleInputChange('properties', 'description', e.target.value)
                      }
                      placeholder="Description"
                      className="min-h-[100px]"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm text-gray-500">Source Position</label>
                        <Select
                          value={properties.sourcePosition ?? 'top'}
                          onValueChange={(value: string) => 
                            handleInputChange('properties', 'sourcePosition', value === '' ? 'top' : value as NodePosition)
                          }
                        >
                          <SelectTrigger>
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
                            handleInputChange('properties', 'targetPosition', value === '' ? 'bottom' : value as NodePosition)
                          }
                        >
                          <SelectTrigger>
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
                  </>
                ) : (
                  <>
                    <p className="text-gray-600">{properties.description}</p>
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
                      value={content.mainText || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                        handleInputChange('content', 'mainText', e.target.value)
                      }
                      placeholder="Main content text"
                      className="min-h-[200px]"
                    />
                  </div>
                ) : content.mainText && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Main Text:</p>
                    <p className="whitespace-pre-wrap">{content.mainText}</p>
                  </div>
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
                              className="min-h-[100px]"
                            />
                          </>
                        ) : (
                          <>
                            <h4 className="font-medium mb-1">{section.title}</h4>
                            <p className="whitespace-pre-wrap">{section.content}</p>
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
        <DialogFooter>
          <div className="flex justify-end gap-2 mt-4">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={handleEdit}>
                Edit
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 