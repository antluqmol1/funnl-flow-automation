import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Download, 
  FileText, 
  FileJson, 
  FileSpreadsheet, 
  FileClock, 
  FileVideo,
  Package 
} from 'lucide-react';
import { 
  downloadTranscription 
} from '@/services/transcriptionExport';
import { TranscriptionResponse } from '@/types/transcription';
import { useToast } from '@/hooks/useToast';

interface ExportOptionsProps {
  transcription: TranscriptionResponse;
  compact?: boolean;
}

/**
 * Componente que muestra opciones para exportar una transcripción en diferentes formatos
 */
const ExportOptions: React.FC<ExportOptionsProps> = ({ 
  transcription, 
  compact = false 
}) => {
  const [format, setFormat] = useState<'txt' | 'json' | 'csv' | 'srt' | 'vtt' | 'zip'>('txt');
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeSpeakers, setIncludeSpeakers] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeKeyPoints, setIncludeKeyPoints] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Formatos disponibles y sus opciones
  const formatOptions = [
    { id: 'txt', label: 'Texto', icon: <FileText className="h-4 w-4" /> },
    { id: 'json', label: 'JSON', icon: <FileJson className="h-4 w-4" /> },
    { id: 'csv', label: 'CSV', icon: <FileSpreadsheet className="h-4 w-4" /> },
    { id: 'srt', label: 'Subtítulos (SRT)', icon: <FileClock className="h-4 w-4" /> },
    { id: 'vtt', label: 'Subtítulos Web (VTT)', icon: <FileVideo className="h-4 w-4" /> },
    { id: 'zip', label: 'Todos los formatos (ZIP)', icon: <Package className="h-4 w-4" /> }
  ];

  // Manejar la exportación
  const handleExport = async () => {
    if (!transcription || !transcription.id) {
      toast({
        title: "Error",
        description: "No hay transcripción disponible para exportar",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsExporting(true);
      
      await downloadTranscription(
        transcription,
        {
          format,
          includeTimestamps,
          includeSpeakers,
          includeSummary,
          includeKeyPoints
        }
      );
      
      toast({
        title: "Exportación completada",
        description: `Transcripción exportada en formato ${format.toUpperCase()}`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error al exportar:', error);
      toast({
        title: "Error",
        description: "No se pudo exportar la transcripción",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Versión compacta para mostrar en modales o espacios reducidos
  if (compact) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {formatOptions.map(option => (
            <Button
              key={option.id}
              variant={format === option.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormat(option.id as any)}
              className="flex items-center gap-1"
            >
              {option.icon}
              <span className="text-xs">{option.label}</span>
            </Button>
          ))}
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="timestamps-compact"
              checked={includeTimestamps}
              onCheckedChange={(checked) => setIncludeTimestamps(!!checked)}
            />
            <Label htmlFor="timestamps-compact" className="text-xs">Marcas de tiempo</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="speakers-compact"
              checked={includeSpeakers}
              onCheckedChange={(checked) => setIncludeSpeakers(!!checked)}
            />
            <Label htmlFor="speakers-compact" className="text-xs">Identificar hablantes</Label>
          </div>
        </div>
        
        <Button 
          onClick={handleExport}
          disabled={isExporting}
          className="w-full"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exportando...' : 'Exportar Transcripción'}
        </Button>
      </div>
    );
  }

  // Versión completa con todas las opciones
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exportar Transcripción</CardTitle>
        <CardDescription>
          Descarga la transcripción en diferentes formatos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Formato de exportación</h3>
          <RadioGroup
            value={format}
            onValueChange={(value) => setFormat(value as any)}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {formatOptions.map(option => (
              <div key={option.id} className="flex items-center space-x-2">
                <RadioGroupItem value={option.id} id={`format-${option.id}`} />
                <Label htmlFor={`format-${option.id}`} className="flex items-center gap-1.5">
                  {option.icon}
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Opciones de contenido</h3>
          
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeTimestamps"
                checked={includeTimestamps}
                onCheckedChange={(checked) => setIncludeTimestamps(!!checked)}
              />
              <Label htmlFor="includeTimestamps">Incluir marcas de tiempo</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeSpeakers"
                checked={includeSpeakers}
                onCheckedChange={(checked) => setIncludeSpeakers(!!checked)}
              />
              <Label htmlFor="includeSpeakers">Identificar hablantes</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeSummary"
                checked={includeSummary}
                onCheckedChange={(checked) => setIncludeSummary(!!checked)}
              />
              <Label htmlFor="includeSummary">Incluir resumen</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeKeyPoints"
                checked={includeKeyPoints}
                onCheckedChange={(checked) => setIncludeKeyPoints(!!checked)}
              />
              <Label htmlFor="includeKeyPoints">Incluir puntos clave</Label>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleExport}
          disabled={isExporting}
          className="w-full"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exportando...' : 'Exportar Transcripción'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ExportOptions; 