import React, { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useTranscriptionContext } from '@/contexts/TranscriptionContext';

interface TranscriptionEditorProps {
  standalone?: boolean; // Si es true, maneja su propio estado
  initialText?: string;
  onSave?: (text: string) => Promise<void>;
  onCancel?: () => void;
}

/**
 * Componente de edición de transcripciones
 */
const TranscriptionEditor: React.FC<TranscriptionEditorProps> = ({
  standalone = false,
  initialText,
  onSave,
  onCancel
}) => {
  // Si es standalone, usar props y estado local
  // Si no, usar el contexto
  const context = standalone ? null : useTranscriptionContext();
  
  const [text, setText] = useState<string>(
    standalone ? (initialText || '') : (context?.editedTranscription || context?.transcription || '')
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  
  // Actualizar estado cuando cambian las props o el contexto
  useEffect(() => {
    if (standalone && initialText !== undefined) {
      setText(initialText);
    } else if (context) {
      setText(context.editedTranscription || context.transcription || '');
    }
  }, [standalone, initialText, context?.editedTranscription, context?.transcription]);
  
  // Verificar si hay cambios
  useEffect(() => {
    if (standalone) {
      setHasChanges(initialText !== text);
    } else if (context) {
      setHasChanges(context.transcription !== text);
    }
  }, [standalone, initialText, context?.transcription, text]);
  
  // Manejar cambios en el texto
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    
    if (!standalone && context) {
      context.updateEditedTranscription(newText);
    }
  };
  
  // Guardar cambios
  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      if (standalone && onSave) {
        await onSave(text);
      } else if (context) {
        await context.saveEditedTranscription();
      }
    } catch (error) {
      console.error('Error al guardar:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Cancelar edición
  const handleCancel = () => {
    if (standalone && onCancel) {
      onCancel();
    } else if (context) {
      context.cancelEditing();
    }
  };
  
  return (
    <div className="space-y-4">
      <Textarea 
        value={text}
        onChange={handleTextChange}
        placeholder="Edita la transcripción aquí..."
        className="min-h-[300px] font-mono text-sm"
      />
      
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
        >
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
};

export default TranscriptionEditor; 