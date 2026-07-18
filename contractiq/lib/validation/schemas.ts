import { z } from 'zod'
import { LIMITS } from '@/lib/constants/terms'

export const contractTypeSchema = z.enum(['nda', 'msa'])

export const uploadFieldsSchema = z.object({
  contract_type: contractTypeSchema,
})

export const processSchema = z.object({
  custom_terms: z
    .array(z.string().trim().min(1).max(80))
    .max(LIMITS.MAX_CUSTOM_TERMS, `A maximum of ${LIMITS.MAX_CUSTOM_TERMS} custom terms is allowed`)
    .optional()
    .default([]),
})

export const keyTermEditSchema = z.object({
  value: z.string().trim().min(1, 'Value cannot be empty').max(2000),
})

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty').max(LIMITS.MAX_MESSAGE_CHARS),
})

export const feedbackSchema = z.object({
  contract_id: z.string().uuid(),
  rating: z.enum(['up', 'down']),
  comment: z.string().trim().max(2000).optional(),
})

export const authSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

export type ProcessInput = z.infer<typeof processSchema>
export type ChatInput = z.infer<typeof chatMessageSchema>
export type FeedbackInput = z.infer<typeof feedbackSchema>
export type AuthInput = z.infer<typeof authSchema>
