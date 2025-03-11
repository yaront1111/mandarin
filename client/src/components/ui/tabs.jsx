// src/components/ui/tabs.jsx
import React, { createContext, useContext, useState } from 'react';
import PropTypes from 'prop-types';

const TabsContext = createContext({
  value: '',
  onChange: () => {}
});

export const Tabs = ({ children, defaultValue, value, onValueChange, className = '' }) => {
  const [tabValue, setTabValue] = useState(defaultValue || '');

  const contextValue = {
    value: value !== undefined ? value : tabValue,
    onChange: (newValue) => {
      if (value === undefined) {
        setTabValue(newValue);
      }
      onValueChange?.(newValue);
    }
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

Tabs.propTypes = {
  children: PropTypes.node.isRequired,
  defaultValue: PropTypes.string,
  value: PropTypes.string,
  onValueChange: PropTypes.func,
  className: PropTypes.string
};

export const TabsList = ({ children, className = '' }) => {
  return (
    <div className={`flex space-x-2 ${className}`}>
      {children}
    </div>
  );
};

TabsList.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export const TabsTrigger = ({ children, value, className = '' }) => {
  const { value: selectedValue, onChange } = useContext(TabsContext);
  const isActive = selectedValue === value;

  return (
    <button
      className={`px-4 py-2 rounded-md font-medium transition-colors ${
        isActive 
          ? 'bg-brand-pink text-white'
          : 'bg-bg-input text-text-secondary hover:bg-opacity-80'
      } ${className}`}
      onClick={() => onChange(value)}
    >
      {children}
    </button>
  );
};

TabsTrigger.propTypes = {
  children: PropTypes.node.isRequired,
  value: PropTypes.string.isRequired,
  className: PropTypes.string
};

export const TabsContent = ({ children, value, className = '' }) => {
  const { value: selectedValue } = useContext(TabsContext);
  const isActive = selectedValue === value;

  if (!isActive) return null;

  return (
    <div className={className}>
      {children}
    </div>
  );
};

TabsContent.propTypes = {
  children: PropTypes.node.isRequired,
  value: PropTypes.string.isRequired,
  className: PropTypes.string
};
