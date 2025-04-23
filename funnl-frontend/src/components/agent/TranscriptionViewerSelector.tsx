import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import TranscriptionViewer from './TranscriptionViewer';
import TranscriptionViewerV2 from './TranscriptionViewerV2';

interface TranscriptionViewerSelectorProps {
  recordingId: string;
  defaultView?: 'v1' | 'v2';
  name?: string;
  allowEdit?: boolean;
}

/**
 * Componente que permite seleccionar entre las dos versiones
 * del visor de transcripciones
 */
const TranscriptionViewerSelector: React.FC<TranscriptionViewerSelectorProps> = ({
  recordingId,
  defaultView = 'v2',
  name = 'Transcripción',
  allowEdit = false
}) => {
  const [selectedView, setSelectedView] = useState<string>(defaultView);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex justify-between items-center">
          {name}
          <ToggleGroup 
            type="single" 
            value={selectedView}
            onValueChange={(value) => value && setSelectedView(value)}
            className="border rounded-md"
          >
            <ToggleGroupItem value="v1" className="text-xs">
              Visor Básico
            </ToggleGroupItem>
            <ToggleGroupItem value="v2" className="text-xs">
              Visor Avanzado
            </ToggleGroupItem>
          </ToggleGroup>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedView === 'v1' ? (
          <TranscriptionViewer 
            recordingId={recordingId} 
            name={name} 
            allowEdit={allowEdit} 
          />
        ) : (
          <TranscriptionViewerV2 
            recordingId={recordingId} 
            name={name}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default TranscriptionViewerSelector; 