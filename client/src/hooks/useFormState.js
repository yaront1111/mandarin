"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { logger } from "../utils/logger"

const log = logger.create("useFormState")

/**
 * Simple validation helper function
 * @param {any} value - The value to validate
 * @param {Object} rules - Validation rules to apply
 * @returns {string|null} Error message or null if valid
 */
const validate = (value, rules = {}) => {
  // Check for required fields
  if (rules.required && !value) return "This field is required"
  
  // Handle different types of values
  if (value !== null && value !== undefined) {
    const valueStr = String(value)
    
    // Check min length
    if (rules.minLength && valueStr.length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters`
    }
    
    // Check max length
    if (rules.maxLength && valueStr.length > rules.maxLength) {
      return `Must be at most ${rules.maxLength} characters`
    }
    
    // Check pattern (regex)
    if (rules.pattern && !rules.pattern.test(valueStr)) {
      return rules.message || "Invalid format"
    }
    
    // Check for email
    if (rules.email && !/^[^@]+@[^@]+\.[^@]+$/.test(valueStr)) {
      return "Please enter a valid email address"
    }
  }
  
  // Custom validation function
  if (rules.custom && typeof rules.custom === 'function') {
    return rules.custom(value)
  }
  
  return null
}

/**
 * Custom hook for form state management
 * 
 * @param {Object} initialValues - Initial form values
 * @param {Object} validationRules - Validation rules for each field
 * @param {Object} options - Hook options
 * @param {boolean} options.validateOnChange - Whether to validate on change
 * @param {boolean} options.validateOnBlur - Whether to validate on blur
 * @param {Function} options.onSubmit - Form submission handler
 * @returns {Object} Form state and methods
 */
export function useFormState(initialValues = {}, validationRules = {}, options = {}) {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    onSubmit: submitHandler = null
  } = options
  
  // State for form values, errors, and metadata
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValid, setIsValid] = useState(false)
  const [submitCount, setSubmitCount] = useState(0)
  
  // Keep a reference to the validation rules which may change
  const rulesRef = useRef(validationRules)
  rulesRef.current = validationRules
  
  // Keep a reference to the submit handler
  const submitHandlerRef = useRef(submitHandler)
  submitHandlerRef.current = submitHandler
  
  /**
   * Validate all form fields
   * @returns {Object} Validation errors
   */
  const validateForm = useCallback(() => {
    const rules = rulesRef.current
    const newErrors = {}
    let formIsValid = true
    
    // Validate each field with rules
    Object.keys(rules).forEach(field => {
      const value = values[field]
      const fieldRules = rules[field]
      
      if (fieldRules) {
        const error = validate(value, fieldRules)
        if (error) {
          newErrors[field] = error
          formIsValid = false
        }
      }
    })
    
    // Update form validity
    setIsValid(formIsValid)
    setErrors(newErrors)
    
    return newErrors
  }, [values])
  
  /**
   * Validate a single field
   * @param {string} name - Field name
   * @param {any} value - Field value
   * @returns {string|null} Error message or null
   */
  const validateField = useCallback((name, value) => {
    const rules = rulesRef.current[name]
    if (!rules) return null
    
    const error = validate(value, rules)
    
    setErrors(prev => ({
      ...prev,
      [name]: error
    }))
    
    return error
  }, [])
  
  /**
   * Handler for field changes
   * @param {Event|Object} e - Change event or value object
   */
  const handleChange = useCallback((e) => {
    // Handle value passed directly
    if (e && typeof e === 'object' && !e.target) {
      // Handle object with multiple values { name1: value1, name2: value2 }
      setValues(prev => ({
        ...prev,
        ...e
      }))
      
      // Only validate if validateOnChange is true
      if (validateOnChange) {
        // Validate each changed field
        Object.entries(e).forEach(([field, value]) => {
          validateField(field, value)
        })
      }
      return
    }
    
    // Handle standard input events
    if (e && e.target) {
      const { name, value, type, checked } = e.target
      const newValue = type === 'checkbox' ? checked : value
      
      setValues(prev => ({
        ...prev,
        [name]: newValue
      }))
      
      setTouched(prev => ({
        ...prev,
        [name]: true
      }))
      
      // Only validate if validateOnChange is true
      if (validateOnChange) {
        validateField(name, newValue)
      }
    }
  }, [validateOnChange, validateField])
  
  /**
   * Handler for field blur events
   * @param {Event} e - Blur event
   */
  const handleBlur = useCallback((e) => {
    if (e && e.target) {
      const { name, value } = e.target
      
      setTouched(prev => ({
        ...prev,
        [name]: true
      }))
      
      // Only validate if validateOnBlur is true
      if (validateOnBlur) {
        validateField(name, value)
      }
    }
  }, [validateOnBlur, validateField])
  
  /**
   * Directly set a field value
   * @param {string} name - Field name
   * @param {any} value - Field value
   */
  const setValue = useCallback((name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Only validate if validateOnChange is true
    if (validateOnChange) {
      validateField(name, value)
    }
  }, [validateOnChange, validateField])
  
  /**
   * Set multiple values at once
   * @param {Object} newValues - Object with field names and values
   */
  const setMultipleValues = useCallback((newValues) => {
    setValues(prev => ({
      ...prev,
      ...newValues
    }))
    
    // Only validate if validateOnChange is true
    if (validateOnChange) {
      Object.entries(newValues).forEach(([field, value]) => {
        validateField(field, value)
      })
    }
  }, [validateOnChange, validateField])
  
  /**
   * Handle form submission
   * @param {Event} e - Submit event
   */
  const handleSubmit = useCallback((e) => {
    // Prevent default form submission
    if (e && e.preventDefault) {
      e.preventDefault()
    }
    
    // Validate all fields
    const newErrors = validateForm()
    
    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, field) => {
      acc[field] = true
      return acc
    }, {})
    
    setTouched(allTouched)
    setSubmitCount(prev => prev + 1)
    
    // Check if form is valid
    const formIsValid = Object.keys(newErrors).length === 0
    
    // Call the submit handler if the form is valid
    if (formIsValid && submitHandlerRef.current) {
      setIsSubmitting(true)
      
      try {
        const result = submitHandlerRef.current(values, e)
        
        // Handle promise results
        if (result && typeof result.then === 'function') {
          result.catch(error => {
            log.error("Form submission error:", error)
          }).finally(() => {
            setIsSubmitting(false)
          })
        } else {
          setIsSubmitting(false)
        }
      } catch (error) {
        log.error("Form submission error:", error)
        setIsSubmitting(false)
      }
    } else {
      setIsSubmitting(false)
    }
    
    return formIsValid
  }, [validateForm, values])
  
  /**
   * Reset the form to initial values
   * @param {Object} newValues - Optional new initial values
   */
  const resetForm = useCallback((newValues = {}) => {
    // Reset to initial values or new values
    const resetValues = Object.keys(newValues).length > 0 ? newValues : initialValues
    
    setValues(resetValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
    setSubmitCount(0)
  }, [initialValues])
  
  /**
   * Set a specific field error message
   * @param {string} name - Field name
   * @param {string} error - Error message
   */
  const setFieldError = useCallback((name, error) => {
    setErrors(prev => ({
      ...prev,
      [name]: error
    }))
  }, [])
  
  /**
   * Set form-level error(s)
   * @param {string|Object} error - Error message or error object
   */
  const setFormError = useCallback((error) => {
    if (typeof error === 'string') {
      // Set a form-level error
      setErrors(prev => ({
        ...prev,
        _form: error
      }))
    } else if (typeof error === 'object') {
      // Set multiple field errors
      setErrors(prev => ({
        ...prev,
        ...error
      }))
    }
  }, [])
  
  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])
  
  // Run validation when rules change significantly
  useEffect(() => {
    validateForm()
  }, [validateForm])
  
  // The form state object to return
  return {
    // Form state
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    submitCount,
    
    // Field manipulation
    handleChange,
    handleBlur,
    setValue,
    setMultipleValues,
    
    // Error handling
    setFieldError,
    setFormError,
    clearErrors,
    
    // Form operations
    handleSubmit,
    resetForm,
    validateForm,
    validateField
  }
}

export default useFormState