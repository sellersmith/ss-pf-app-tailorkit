/**
 * Image processing utilities
 *
 * This module provides utilities for:
 * - Image dimension and URL validation
 * - Processing constants and thresholds
 * - Timeout calculation for large images
 * - Anti-aliasing and background removal (server-side)
 */

// Validation utilities
export * from './validation'

// Constants
export * from './constants'

// Timeout calculation
export * from './timeout-calculator'

// Core processing utilities (server-side)
export * from './core/anti-aliasing.server'
export * from './core/solid-bg-removal.server'
