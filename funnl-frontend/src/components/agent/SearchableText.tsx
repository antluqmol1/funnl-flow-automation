import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchableTextProps {
  text: string | null;
  className?: string;
  placeholder?: string;
  isLoading?: boolean;
  highlightColor?: string;
  currentHighlightColor?: string;
  showSearchCount?: boolean;
}

/**
 * Componente de texto con funcionalidad de búsqueda y resaltado
 */
const SearchableText: React.FC<SearchableTextProps> = ({
  text,
  className = '',
  placeholder = 'Buscar en el texto...',
  isLoading = false,
  highlightColor = 'bg-yellow-200',
  currentHighlightColor = 'bg-yellow-400',
  showSearchCount = true
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Realizar búsqueda cuando cambia el término
  useEffect(() => {
    if (!debouncedSearchTerm.trim() || !text) {
      setSearchResults([]);
      setCurrentIndex(-1);
      return;
    }

    try {
      const results: number[] = [];
      const searchRegex = new RegExp(debouncedSearchTerm, 'gi');
      let match;
      
      while ((match = searchRegex.exec(text)) !== null) {
        results.push(match.index);
      }
      
      setSearchResults(results);
      setCurrentIndex(results.length > 0 ? 0 : -1);
    } catch (error) {
      // Manejar errores de regex inválidos
      console.error('Error en la expresión de búsqueda:', error);
    }
  }, [debouncedSearchTerm, text]);

  // Manejar navegación entre resultados
  const navigate = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    
    let newIndex = currentIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentIndex - 1 + searchResults.length) % searchResults.length;
    }
    
    setCurrentIndex(newIndex);
    scrollToResult(newIndex);
  };

  // Desplazarse al resultado actual
  const scrollToResult = (index: number) => {
    if (index < 0 || !containerRef.current) return;
    
    const container = containerRef.current;
    const highlights = container.querySelectorAll(`.${currentHighlightColor.replace('bg-', '')}`);
    
    if (highlights.length > 0) {
      const element = highlights[0] as HTMLElement;
      
      // Calcular posición para mostrar el elemento
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      // Asegurar que el elemento esté visible
      const isInView = (
        elementRect.top >= containerRect.top &&
        elementRect.bottom <= containerRect.bottom
      );
      
      if (!isInView) {
        const scrollPosition = elementRect.top - containerRect.top - containerRect.height / 2;
        container.scrollTop += scrollPosition;
      }
    }
  };

  // Limpiar búsqueda
  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setCurrentIndex(-1);
    inputRef.current?.focus();
  };

  // Generar texto con resaltado
  const renderHighlightedText = () => {
    if (!text) return null;
    
    if (!debouncedSearchTerm.trim()) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }
    
    try {
      const parts = [];
      let lastIndex = 0;
      const term = debouncedSearchTerm;
      const regex = new RegExp(term, 'gi');
      let match;
      let i = 0;
      
      while ((match = regex.exec(text)) !== null) {
        // Texto anterior al match
        parts.push(text.substring(lastIndex, match.index));
        
        // Texto del match (resaltado)
        const isCurrentMatch = i === currentIndex;
        parts.push(
          <mark 
            key={`match-${i}`}
            className={isCurrentMatch ? currentHighlightColor : highlightColor}
          >
            {text.substring(match.index, match.index + term.length)}
          </mark>
        );
        
        lastIndex = match.index + term.length;
        i++;
      }
      
      // Texto después del último match
      parts.push(text.substring(lastIndex));
      
      return <div className="whitespace-pre-wrap">{parts}</div>;
    } catch (error) {
      // Manejar errores de regex
      return <div className="whitespace-pre-wrap">{text}</div>;
    }
  };

  // Renderizar esqueleto de carga
  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="relative">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 pr-20"
        />
        
        {searchTerm && (
          <div className="absolute right-2 top-1.5 flex items-center gap-1">
            {showSearchCount && (
              <span className="text-xs text-gray-500">
                {searchResults.length > 0 
                  ? `${currentIndex + 1} de ${searchResults.length}` 
                  : 'No hay resultados'}
              </span>
            )}
            
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => navigate('prev')}
                disabled={searchResults.length === 0}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => navigate('next')}
                disabled={searchResults.length === 0}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={clearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <div 
        ref={containerRef}
        className="relative h-[calc(100%-40px)] max-h-[500px] overflow-y-auto rounded-md border p-4 text-sm"
      >
        {renderHighlightedText()}
      </div>
    </div>
  );
};

export default SearchableText; 