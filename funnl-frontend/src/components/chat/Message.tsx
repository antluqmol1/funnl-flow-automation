import React from 'react';
import { Spinner } from '../ui/spinner';
import { type Message } from '../../pages/Agent';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageProps {
  message: Message;
}

const markdownComponents = {
    p: ({node, ...props}: any) => <p className="mb-1 last:mb-0" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc list-inside pl-5 my-1 space-y-1" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal list-inside pl-5 my-1 space-y-1" {...props} />,
    li: ({node, ...props}: any) => <li className="pb-0.5" {...props} />,
    strong: ({node, ...props}: any) => <strong className="font-semibold" {...props} />,
    a: ({node, ...props}: any) => <a className="text-blue-400 underline hover:text-blue-300" target="_blank" rel="noopener noreferrer" {...props} />,
};

const MessageComponent: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  // Formatear la fecha relativa (ej: "hace 5 minutos")
  const formattedTime = formatDistanceToNow(message.timestamp, {
    addSuffix: true,
    locale: es
  });
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div 
        className={`
          relative max-w-md px-4 py-2 rounded-lg shadow-sm
          ${isUser ? 'bg-blue-600 text-white' : isSystem ? 'bg-yellow-100 text-yellow-800' : 'bg-white text-gray-800'}
          ${isUser ? 'rounded-br-none' : 'rounded-bl-none'}
        `}
        style={{ maxWidth: '85%' }}
      >
        {!isUser && (
          <div className="flex items-center mb-1">
            <div 
              className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center mr-2 text-xs font-medium"
            >
              {isSystem ? '!' : 'AI'}
            </div>
            <span className="text-xs text-gray-500">{formattedTime}</span>
          </div>
        )}

        {message.isProcessingAudio ? (
          <div className="flex items-center space-x-2 py-2">
            <Spinner size="sm" />
            <span className="text-sm">Procesando audio...</span>
          </div>
        ) : (
          <div className="text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
                {message.content}
            </ReactMarkdown>
          </div>
        )}
        
        {isUser && (
          <div className="flex justify-end mt-1">
            <span className="text-xs text-blue-200">{formattedTime}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageComponent; 