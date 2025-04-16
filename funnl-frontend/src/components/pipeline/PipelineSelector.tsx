import React from 'react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

interface PipelineSelectorProps {
  pipelines: Pipeline[];
  selectedPipeline: Pipeline | null;
  onChange: (pipeline: Pipeline) => void;
}

const PipelineSelector: React.FC<PipelineSelectorProps> = ({ 
  pipelines, 
  selectedPipeline, 
  onChange 
}) => {
  const handleChange = (value: string) => {
    const pipeline = pipelines.find(p => p.id === value);
    if (pipeline) {
      onChange(pipeline);
    }
  };

  return (
    <div className="w-64">
      <Select
        value={selectedPipeline?.id}
        onValueChange={handleChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Seleccionar un pipeline" />
        </SelectTrigger>
        <SelectContent>
          {pipelines.map((pipeline) => (
            <SelectItem 
              key={pipeline.id} 
              value={pipeline.id}
            >
              {pipeline.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default PipelineSelector; 