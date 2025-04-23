import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  error: null,
  signOut: async () => {},
  refreshSession: async () => false,
});

export const useUser = () => useContext(UserContext);

interface UserProviderProps {
  children: React.ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Obtener la sesión actual al montar el componente
    const getInitialSession = async () => {
      try {
        console.log("Obteniendo sesión inicial...");
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        console.log("Sesión obtenida:", data?.session ? "Usuario autenticado" : "No hay sesión activa");
        setUser(data?.session?.user || null);
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Error desconocido'));
        console.error('Error al obtener la sesión:', e);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Suscribirse a cambios de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Evento de autenticación:", event);
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    // Limpiar suscripción al desmontar
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Error al cerrar sesión'));
      console.error('Error al cerrar sesión:', e);
    } finally {
      setLoading(false);
    }
  };

  // Función para refrescar la sesión
  const refreshSession = async (): Promise<boolean> => {
    try {
      console.log("Intentando refrescar sesión...");
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("Error al refrescar sesión:", error);
        return false;
      }
      
      if (data && data.session) {
        console.log("Sesión refrescada correctamente");
        setUser(data.session.user);
        return true;
      } else {
        console.log("No se pudo obtener una sesión nueva");
        return false;
      }
    } catch (e) {
      console.error("Error inesperado al refrescar sesión:", e);
      return false;
    }
  };

  // Mock del usuario para desarrollo si no hay usuario autenticado
  if (!user && process.env.NODE_ENV === 'development') {
    const mockUser = {
      id: 'mock-user-id',
      email: 'usuario.prueba@example.com',
    } as User;
    
    return (
      <UserContext.Provider
        value={{
          user: mockUser,
          loading,
          error,
          signOut,
          refreshSession,
        }}
      >
        {children}
      </UserContext.Provider>
    );
  }

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        error,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider; 