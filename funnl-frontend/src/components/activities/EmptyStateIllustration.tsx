import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Sun, Cloud, Leaf } from 'lucide-react';

interface EmptyStateIllustrationProps {
  message?: string;
  className?: string;
}

const EmptyStateIllustration: React.FC<EmptyStateIllustrationProps> = ({
  message = "¡No hay tareas pendientes de momento!",
  className = "",
}) => {
  return (
    <motion.div 
      className={`w-full flex flex-col items-center justify-center py-10 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Escena de naturaleza con texto centrado */}
      <div className="relative w-full max-w-md min-h-[260px] flex flex-col items-center justify-center">
        {/* Mensaje centrado */}
        <motion.div
          className="text-center z-10 mb-4"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h3 className="text-xl font-medium text-gray-700 mb-2">{message}</h3>
          <p className="text-gray-500 max-w-xs mx-auto">
            Disfruta este momento de paz y tranquilidad. Tu agenda está despejada.
          </p>
        </motion.div>
        
        {/* Sol brillante - arriba a la derecha */}
        <motion.div 
          className="absolute top-0 right-10"
          animate={{ 
            rotate: 360,
            y: [0, -5, 0]
          }}
          transition={{ 
            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
            y: { duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
          }}
        >
          <Sun className="h-12 w-12 text-amber-400" />
          <motion.div 
            className="absolute inset-0 rounded-full bg-amber-200 blur-lg"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </motion.div>

        {/* Nubes flotantes - distintas posiciones */}
        <motion.div 
          className="absolute top-4 left-6"
          animate={{ x: [0, 10, 0], y: [0, -3, 0] }}
          transition={{ 
            x: { duration: 8, repeat: Infinity, ease: "easeInOut" },
            y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <Cloud className="h-8 w-8 text-white" fill="#fff" />
        </motion.div>

        <motion.div 
          className="absolute bottom-4 right-8"
          animate={{ x: [0, -15, 0], y: [0, 3, 0] }}
          transition={{ 
            x: { duration: 10, repeat: Infinity, ease: "easeInOut" },
            y: { duration: 7, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <Cloud className="h-10 w-10 text-white" fill="#fff" />
        </motion.div>

        {/* Pájaros volando - arriba */}
        <motion.svg
          className="absolute top-8 left-1/4"
          width="30"
          height="12"
          viewBox="0 0 30 12"
          animate={{ 
            x: [0, 40, 0], 
            y: [0, -8, 0] 
          }}
          transition={{ 
            duration: 15, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <path
            d="M1 6C3 4 5 3 7 6C9 3 11 4 13 6C15 4 17 3 19 6C21 3 23 4 25 6C27 4 29 3 31 6"
            stroke="#666"
            strokeWidth="1"
            fill="none"
          />
        </motion.svg>

        <motion.svg
          className="absolute top-16 right-1/4"
          width="20"
          height="8"
          viewBox="0 0 20 8"
          animate={{ 
            x: [0, -20, 0], 
            y: [0, -5, 0] 
          }}
          transition={{ 
            duration: 12, 
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        >
          <path
            d="M1 4C2 3 3 2 4 4C5 2 6 3 7 4C8 3 9 2 10 4C11 2 12 3 13 4C14 3 15 2 16 4"
            stroke="#666"
            strokeWidth="1"
            fill="none"
          />
        </motion.svg>

        {/* Hojas flotando - alrededor del texto */}
        <motion.div 
          className="absolute top-16 left-12"
          animate={{ 
            y: [0, -10, 0],
            rotate: [0, 20, 0]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          <Leaf className="h-6 w-6 text-green-500" />
        </motion.div>

        <motion.div 
          className="absolute bottom-10 right-20"
          animate={{ 
            y: [0, 10, 0],
            rotate: [0, -30, 0]
          }}
          transition={{ 
            duration: 5, 
            repeat: Infinity,
            repeatType: "reverse",
            delay: 1
          }}
        >
          <Leaf className="h-5 w-5 text-green-600" />
        </motion.div>
        
        <motion.div 
          className="absolute bottom-16 left-20"
          animate={{ 
            y: [0, 8, 0],
            rotate: [0, 15, 0]
          }}
          transition={{ 
            duration: 4.5, 
            repeat: Infinity,
            repeatType: "reverse",
            delay: 0.5
          }}
        >
          <Leaf className="h-5 w-5 text-green-400" />
        </motion.div>
        
        <motion.div 
          className="absolute top-10 right-16"
          animate={{ 
            y: [0, -6, 0],
            rotate: [0, -15, 0]
          }}
          transition={{ 
            duration: 3.5, 
            repeat: Infinity,
            repeatType: "reverse",
            delay: 1.5
          }}
        >
          <Leaf className="h-4 w-4 text-green-500" />
        </motion.div>
        
        {/* Partículas brillantes - alrededor del texto */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{ 
              opacity: 0,
              scale: 0
            }}
            animate={{ 
              opacity: [0, 0.8, 0],
              scale: [0, 1, 0]
            }}
            transition={{ 
              duration: 2 + Math.random() * 3,
              delay: i * 0.3,
              repeat: Infinity,
              repeatDelay: Math.random() * 2
            }}
            style={{ 
              top: `${Math.random() * 100}%`, 
              left: `${Math.random() * 100}%` 
            }}
          >
            <Sparkles className={`h-3 w-3 text-${
              ['amber-300', 'yellow-200', 'green-300', 'blue-200', 'purple-200', 'pink-200', 'green-400', 'blue-300', 'amber-400', 'blue-300', 'green-200', 'yellow-300'][i % 12]
            }`} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default EmptyStateIllustration; 