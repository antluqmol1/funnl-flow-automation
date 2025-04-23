import { useState, useEffect } from 'react';

/**
 * Hook personalizado para aplicar "debounce" a un valor
 * @param value Valor a aplicar debounce
 * @param delay Tiempo de espera en milisegundos
 * @returns Valor con debounce
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // Actualizar el valor después del tiempo de espera
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Limpiar el timer si el valor cambia antes del tiempo de espera
        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
} 