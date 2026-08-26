<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTrackerStore } from '@/stores/tracker'
import PanelCard from '@/components/PanelCard.vue'
import ErrorNotice from '@/components/ErrorNotice.vue'
import type { FeedbackSubmission, SentimentWord } from '@/types/tracker'
import { isTrackerError, TrackerError } from '@/api/errors'

type Step = 'acf2' | 'sentiment' | 'time' | 'barriers' | 'signals' | 'review'

const store = useTrackerStore()
const { busy } = storeToRefs(store)

const currentStep = ref<Step>('acf2')
const acf2Id = ref('')
const sentiment = ref(5)
const timeBefore = ref('')
const timeAfter = ref('')
const selectedBarriers = ref<string[]>([])
const selectedValueSignals = ref<string[]>([])
const error = ref<TrackerError | null>(null)

const valueSignalOptions = [
  { id: 'speed', label: '⚡ Speed', description: 'Faster task completion' },
  { id: 'quality', label: '✨ Quality', description: 'Better quality outputs' },
  { id: 'learning', label: '📚 Learning', description: 'Helped me learn' },
  { id: 'consistency', label: '🎯 Consistency', description: 'More consistent results' },
  { id: 'other', label: '💡 Other', description: 'Something else' },
]

const steps: Step[] = ['acf2', 'sentiment', 'time', 'barriers', 'signals', 'review']
const stepIndex = computed(() => steps.indexOf(currentStep.value))
const totalSteps = steps.length

const barrierOptions = [
  'Integration with existing tools',
  'Lack of training or guidance',
  'Quality of outputs',
  'Time to get accurate results',
  'Trust in AI reliability',
  'Privacy or data security concerns',
  'Cost considerations',
  'Other reasons',
]

function getSentimentLabel(value: number): string {
  if (value <= 2) return 'Poor'
  if (value <= 4) return 'Below Average'
  if (value <= 6) return 'Average'
  if (value <= 8) return 'Good'
  return 'Excellent'
}

function canProceed(): boolean {
  switch (currentStep.value) {
    case 'acf2':
      return acf2Id.value.trim().length > 0
    case 'sentiment':
      return true
    case 'time': {
      const before = String(timeBefore.value).trim()
      const after = String(timeAfter.value).trim()
      return before.length > 0 && after.length > 0
    }
    case 'barriers':
      return selectedBarriers.value.length > 0
    case 'signals':
      return true
    default:
      return true
  }
}

function isValidJson(str: string): boolean {
  if (!str.trim()) return true
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

function nextStep(): void {
  if (!canProceed()) return
  const currentIdx = stepIndex.value
  if (currentIdx < steps.length - 1) {
    currentStep.value = steps[currentIdx + 1]
    error.value = null
  }
}

function prevStep(): void {
  const currentIdx = stepIndex.value
  if (currentIdx > 0) {
    currentStep.value = steps[currentIdx - 1]
  }
}

function toggleBarrier(barrier: string): void {
  const idx = selectedBarriers.value.indexOf(barrier)
  if (idx > -1) {
    selectedBarriers.value.splice(idx, 1)
  } else {
    selectedBarriers.value.push(barrier)
  }
}

function toggleValueSignal(signal: string): void {
  const idx = selectedValueSignals.value.indexOf(signal)
  if (idx > -1) {
    selectedValueSignals.value.splice(idx, 1)
  } else {
    selectedValueSignals.value.push(signal)
  }
}

function getTimeSavingsSummary(): string {
  if (!timeBefore.value || !timeAfter.value) return ''
  const before = parseFloat(timeBefore.value)
  const after = parseFloat(timeAfter.value)
  if (isNaN(before) || isNaN(after)) return ''
  const saved = before - after
  const percent = before > 0 ? Math.round((saved / before) * 100) : 0
  if (saved > 0) {
    return `Saved ${saved.toFixed(1)} hours (${percent}% reduction)`
  } else if (saved < 0) {
    return `Added ${Math.abs(saved).toFixed(1)} hours (${Math.abs(percent)}% increase)`
  }
  return 'No time difference'
}

async function submitFeedback(): Promise<void> {
  error.value = null
  const trimmedAcf2 = acf2Id.value.trim()
  if (!trimmedAcf2) {
    error.value = new TrackerError({
      kind: 'shape',
      title: 'ACF2 ID is required',
      detail: 'Please go back and enter your ACF2 ID.',
      action: 'Enter your ACF2 ID to proceed.',
    })
    return
  }

  const sentimentMap: Record<number, SentimentWord> = {
    1: 'negative',
    2: 'negative',
    3: 'negative',
    4: 'negative',
    5: 'neutral',
    6: 'neutral',
    7: 'positive',
    8: 'positive',
    9: 'positive',
    10: 'positive',
  }

  const submission: FeedbackSubmission = {
    acf2_id: trimmedAcf2,
    sentiment: sentimentMap[sentiment.value],
  }

  if (timeBefore.value && timeAfter.value) {
    const after = parseFloat(timeAfter.value)
    if (!isNaN(after)) {
      submission.time_saved = Math.max(0, parseFloat(timeBefore.value) - after)
    }
  }

  if (selectedBarriers.value.length > 0) {
    submission.barriers = selectedBarriers.value.join('; ')
  }

  if (selectedValueSignals.value.length > 0) {
    submission.value_signals = selectedValueSignals.value
  }

  try {
    await store.submitFeedback(submission)
    currentStep.value = 'acf2'
    acf2Id.value = ''
    sentiment.value = 5
    timeBefore.value = ''
    timeAfter.value = ''
    selectedBarriers.value = []
    selectedValueSignals.value = []
  } catch (cause) {
    if (isTrackerError(cause)) {
      error.value = cause
    } else {
      error.value = new TrackerError({
        kind: 'http',
        title: 'Failed to submit feedback',
        detail: cause instanceof Error ? cause.message : String(cause),
        action: 'Check the fields and try again.',
      })
    }
  }
}
</script>

<template>
  <div class="wizard-container">
    <PanelCard title="Share Your Feedback" note="Help us improve by sharing your experience with the AI agent">
      <div class="progress-bar">
        <div class="progress-fill">
          <div class="progress-fill-inner" :style="{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }"></div>
        </div>
        <div class="progress-steps">
          <div
            v-for="(step, idx) in steps"
            :key="step"
            class="progress-step"
            :class="{ active: idx <= stepIndex, current: step === currentStep }"
          >
            {{ idx + 1 }}
          </div>
        </div>
      </div>

      <ErrorNotice v-if="error" :error="error" @dismiss="error = null" />

      <!-- Step 1: ACF2 ID -->
      <div v-if="currentStep === 'acf2'" class="step-content">
        <h2>Let's get started</h2>
        <p class="step-description">We need your ACF2 ID to record your feedback.</p>
        <label class="field">
          <span class="label">ACF2 ID *</span>
          <input v-model="acf2Id" type="text" class="input" placeholder="Enter your ACF2 ID" autocomplete="off" />
        </label>
      </div>

      <!-- Step 2: Sentiment -->
      <div v-if="currentStep === 'sentiment'" class="step-content">
        <h2>How satisfied are you?</h2>
        <p class="step-description">Rate your overall experience with the AI agent on a scale of 1 to 10.</p>
        <div class="sentiment-container">
          <div class="sentiment-scale">
            <div class="scale-labels">
              <span>Poor</span>
              <span>Excellent</span>
            </div>
            <input v-model.number="sentiment" type="range" min="1" max="10" class="sentiment-slider" />
            <div class="sentiment-display">
              <div class="score">{{ sentiment }}/10</div>
              <div class="label">{{ getSentimentLabel(sentiment) }}</div>
            </div>
          </div>
          <div class="sentiment-info">
            <div v-for="i in 10" :key="i" class="sentiment-marker" :style="{ left: `${(i - 1) * 10}%` }">
              {{ i }}
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Time Tracking -->
      <div v-if="currentStep === 'time'" class="step-content">
        <h2>Time comparison</h2>
        <p class="step-description">How much time did tasks take before and after using the AI agent?</p>
        <div class="time-fields">
          <label class="field">
            <span class="label">Time before AI agent (hours) *</span>
            <input
              v-model="timeBefore"
              type="number"
              step="0.25"
              min="0"
              class="input"
              placeholder="e.g., 4.5"
            />
            <span class="field__hint">Time it used to take to complete the task</span>
          </label>

          <label class="field">
            <span class="label">Time after using AI (hours) *</span>
            <input
              v-model="timeAfter"
              type="number"
              step="0.25"
              min="0"
              class="input"
              placeholder="e.g., 2"
            />
            <span class="field__hint">Time it takes now with AI assistance</span>
          </label>
        </div>

        <div v-if="getTimeSavingsSummary()" class="time-summary">
          <div class="summary-icon">⏱️</div>
          <div class="summary-text">{{ getTimeSavingsSummary() }}</div>
        </div>
      </div>

      <!-- Step 4: Barriers -->
      <div v-if="currentStep === 'barriers'" class="step-content">
        <h2>What got in the way?</h2>
        <p class="step-description">Select one or more barriers that prevented you from using the AI more.</p>
        <div class="barriers-grid">
          <label v-for="barrier in barrierOptions" :key="barrier" class="barrier-option">
            <input
              type="checkbox"
              :checked="selectedBarriers.includes(barrier)"
              @change="toggleBarrier(barrier)"
            />
            <span class="barrier-label">{{ barrier }}</span>
          </label>
        </div>
      </div>

      <!-- Step 5: Value Signals -->
      <div v-if="currentStep === 'signals'" class="step-content">
        <h2>Where did it help most?</h2>
        <p class="step-description">Select areas where the AI added the most value (optional).</p>
        <div class="value-signals-grid">
          <button
            v-for="option in valueSignalOptions"
            :key="option.id"
            type="button"
            class="value-signal-card"
            :class="{ selected: selectedValueSignals.includes(option.id) }"
            @click="toggleValueSignal(option.id)"
          >
            <div class="signal-label">{{ option.label }}</div>
            <div class="signal-description">{{ option.description }}</div>
            <div v-if="selectedValueSignals.includes(option.id)" class="signal-check">✓</div>
          </button>
        </div>
        <p class="signals-note">Optional - you can skip this or select multiple options</p>
      </div>

      <!-- Step 6: Review -->
      <div v-if="currentStep === 'review'" class="step-content">
        <h2>Review your feedback</h2>
        <p class="step-description">Please review your responses before submitting.</p>
        <div class="review-section">
          <div class="review-item">
            <span class="review-label">ACF2 ID</span>
            <span class="review-value">{{ acf2Id }}</span>
          </div>
          <div class="review-item">
            <span class="review-label">Satisfaction</span>
            <span class="review-value">{{ sentiment }}/10 ({{ getSentimentLabel(sentiment) }})</span>
          </div>
          <div class="review-item">
            <span class="review-label">Time saved</span>
            <span class="review-value">{{ getTimeSavingsSummary() || 'Not entered' }}</span>
          </div>
          <div v-if="selectedBarriers.length > 0" class="review-item">
            <span class="review-label">Barriers</span>
            <span class="review-value">{{ selectedBarriers.join(', ') }}</span>
          </div>
          <div v-if="selectedValueSignals.length > 0" class="review-item">
            <span class="review-label">Value Signals</span>
            <span class="review-value">{{ selectedValueSignals.join(', ') }}</span>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="wizard-actions">
        <button
          v-if="stepIndex > 0"
          type="button"
          class="button button--secondary"
          @click="prevStep"
        >
          ← Back
        </button>

        <button
          v-if="currentStep !== 'review'"
          type="button"
          class="button button--primary"
          :disabled="!canProceed()"
          @click="nextStep"
        >
          Next →
        </button>

        <button
          v-if="currentStep === 'review'"
          type="button"
          class="button button--primary"
          :disabled="busy.send"
          @click="submitFeedback"
        >
          {{ busy.send ? 'Submitting…' : 'Submit Feedback' }}
        </button>
      </div>
    </PanelCard>
  </div>
</template>

<style scoped>
.wizard-container {
  display: grid;
  gap: var(--step-4);
  max-width: 700px;
  margin: 0 auto;
  padding: var(--step-4);
}

.progress-bar {
  position: relative;
  margin-bottom: var(--step-8);
  padding: var(--step-5) 0;
}

.progress-fill {
  position: absolute;
  top: 20px;
  left: calc(20px + 20px);
  right: calc(20px + 20px);
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  z-index: 0;
  overflow: hidden;
}

.progress-fill-inner {
  height: 100%;
  background: linear-gradient(90deg, #4f46e5, #7c3aed);
  border-radius: 2px;
  transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 8px rgba(79, 70, 229, 0.4);
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  position: relative;
  z-index: 2;
  gap: var(--step-2);
  padding: 0 0;
}

.progress-step {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--paper);
  border: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  color: #9ca3af;
  transition: all 0.3s ease;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.progress-step.active {
  background: #ede9fe;
  border-color: #7c3aed;
  color: #7c3aed;
}

.progress-step.current {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border-color: #4f46e5;
  color: white;
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
  transform: scale(1.05);
}

.step-content {
  padding: var(--step-6) var(--step-4);
  min-height: 320px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, rgba(245, 240, 255, 0.5), rgba(240, 245, 255, 0.5));
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.step-content h2 {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 var(--step-2) 0;
  color: #1f2937;
  letter-spacing: -0.5px;
}

.step-description {
  color: #6b7280;
  margin-bottom: var(--step-5);
  line-height: 1.6;
  font-size: 0.95rem;
}

.field {
  display: grid;
  gap: var(--step-2);
  margin-bottom: var(--step-5);
}

.label {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.95rem;
  letter-spacing: 0.3px;
}

.input {
  padding: 12px 14px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  background: white;
  color: #1f2937;
  transition: all 0.3s;
}

.input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1), 0 0 0 1px #4f46e5;
  background: #fafaf8;
}

.input::placeholder {
  color: #d1d5db;
}

.field__hint {
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: -4px;
}

.field__error {
  font-size: 0.85rem;
  color: #dc2626;
  font-weight: 500;
  margin-top: -4px;
}

/* Sentiment Scale */
.sentiment-container {
  display: grid;
  gap: var(--step-5);
  padding: var(--step-5);
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.sentiment-scale {
  display: grid;
  gap: var(--step-4);
}

.scale-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #6b7280;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.sentiment-slider {
  width: 100%;
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(90deg, #ef4444 0%, #f97316 25%, #eab308 50%, #84cc16 75%, #22c55e 100%);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.sentiment-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: 3px solid white;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
  transition: all 0.2s;
}

.sentiment-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.5);
}

.sentiment-slider::-moz-range-thumb {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: 3px solid white;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
  transition: all 0.2s;
}

.sentiment-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--step-2);
  padding: var(--step-4);
  background: #f9fafb;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
}

.score {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.sentiment-info {
  position: relative;
  display: flex;
  justify-content: space-between;
  height: 24px;
  margin-top: var(--step-2);
}

.sentiment-marker {
  position: absolute;
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: 500;
  transform: translateX(-50%);
  top: 0;
}

/* Time Fields */
.time-fields {
  display: grid;
  gap: var(--step-5);
}

.time-summary {
  display: flex;
  align-items: center;
  gap: var(--step-3);
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
  border-left: 4px solid #22c55e;
  border-radius: 10px;
  margin-top: var(--step-4);
  animation: slideIn 0.4s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.summary-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.summary-text {
  color: #1f2937;
  font-weight: 600;
  font-size: 0.95rem;
}

/* Barriers Grid */
.barriers-grid {
  display: grid;
  gap: var(--step-3);
}

.barrier-option {
  display: flex;
  align-items: center;
  gap: var(--step-3);
  padding: 14px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  background: white;
}

.barrier-option:hover {
  background: #f3f4f6;
  border-color: #4f46e5;
  transform: translateX(4px);
}

.barrier-option input[type='checkbox'] {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #4f46e5;
  flex-shrink: 0;
}

.barrier-option input[type='checkbox']:checked {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
}

.barrier-label {
  color: #1f2937;
  font-weight: 500;
  cursor: pointer;
}

/* Value Signals */
.value-signals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--step-3);
  margin-bottom: var(--step-4);
}

.value-signal-card {
  position: relative;
  padding: 20px 16px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--step-2);
}

.value-signal-card:hover {
  border-color: #4f46e5;
  background: #f9fafb;
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
}

.value-signal-card.selected {
  background: linear-gradient(135deg, #ede9fe, #faf5ff);
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1), inset 0 0 0 2px #7c3aed;
}

.signal-label {
  font-weight: 700;
  color: #1f2937;
  font-size: 1rem;
}

.signal-description {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 400;
}

.signal-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  animation: scaleIn 0.3s ease-out;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.signals-note {
  font-size: 0.85rem;
  color: #6b7280;
  text-align: center;
  margin: 0;
}

/* Review Section */
.review-section {
  display: grid;
  gap: 0;
  padding: 0;
  background: white;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.review-item {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: var(--step-4);
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
  transition: background 0.3s;
}

.review-item:hover {
  background: #f9fafb;
}

.review-item:last-child {
  border-bottom: none;
}

.review-label {
  font-weight: 700;
  color: #4f46e5;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.review-value {
  color: #1f2937;
  font-weight: 500;
  font-size: 0.95rem;
}

/* Wizard Actions */
.wizard-actions {
  display: flex;
  gap: var(--step-3);
  margin-top: var(--step-8);
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  padding-top: var(--step-4);
  border-top: 1px solid #e5e7eb;
}

.button {
  padding: 12px 28px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
  min-width: 140px;
  position: relative;
}

.button--primary {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

.button--primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);
}

.button--primary:active:not(:disabled) {
  transform: translateY(0);
}

.button--primary:disabled {
  background: #d1d5db;
  color: #9ca3af;
  cursor: not-allowed;
  box-shadow: none;
}

.button--secondary {
  background: white;
  color: #4f46e5;
  border: 2px solid #4f46e5;
}

.button--secondary:hover {
  background: #f3f4f6;
  transform: translateY(-2px);
}

.button--secondary:active {
  transform: translateY(0);
}

@media (max-width: 768px) {
  .wizard-container {
    padding: var(--step-3);
  }

  .progress-step {
    width: 36px;
    height: 36px;
    font-size: 0.8rem;
  }

  .step-content {
    min-height: auto;
    padding: var(--step-4) var(--step-3);
  }

  .step-content h2 {
    font-size: 1.5rem;
  }

  .review-item {
    grid-template-columns: 1fr;
    gap: var(--step-2);
  }

  .review-label {
    font-size: 0.8rem;
  }

  .sentiment-display {
    padding: var(--step-3);
  }

  .score {
    font-size: 2rem;
  }

  .wizard-actions {
    flex-direction: column-reverse;
    gap: var(--step-2);
  }

  .button {
    width: 100%;
    min-width: unset;
  }
}
</style>
