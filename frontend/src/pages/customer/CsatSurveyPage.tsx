import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Frown, HeartHandshake, Loader2, Smile, Star } from 'lucide-react';
import http from '../../services/http';
import { APIS } from '../../services/apis';

type Emotion = 'happy' | 'sad' | '';

interface SurveyQuestionConfig {
  star_label: string;
  emotion_label: string;
  comment_label: string;
  star_required: boolean;
  emotion_required: boolean;
  comment_required: boolean;
  comment_max_length: number;
}

interface SurveyResponseData {
  token: string;
  ticket_id: string;
  business_name: string;
  business_logo_url?: string | null;
  survey_title: string;
  intro_text: string;
  thank_you_title: string;
  thank_you_message: string;
  questions: SurveyQuestionConfig;
  allow_multiple_submissions: boolean;
  already_submitted: boolean;
  submitted_at?: string | null;
  submitted_response?: {
    star_rating?: number | null;
    emotion?: 'happy' | 'sad' | null;
    comment?: string | null;
    normalized_score?: number | null;
  } | null;
}

const CsatSurveyPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [survey, setSurvey] = useState<SurveyResponseData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [starRating, setStarRating] = useState<number | null>(null);
  const [emotion, setEmotion] = useState<Emotion>('');
  const [comment, setComment] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const loadSurvey = async () => {
      if (!token) {
        setErrorMessage('Invalid survey link.');
        setLoading(false);
        return;
      }

      try {
        const response = await http.get<SurveyResponseData>(`${APIS.PUBLIC_CSAT_SURVEY}${token}/`);
        setSurvey(response.data);
        setSubmitted(Boolean(response.data.already_submitted && !response.data.allow_multiple_submissions));
        if (response.data.submitted_response) {
          setStarRating(response.data.submitted_response.star_rating ?? null);
          setEmotion((response.data.submitted_response.emotion ?? '') as Emotion);
          setComment(response.data.submitted_response.comment ?? '');
        }
      } catch (error: unknown) {
        const backendMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setErrorMessage(backendMessage || 'Unable to load this survey.');
      } finally {
        setLoading(false);
      }
    };

    loadSurvey();
  }, [token]);

  const logoInitials = useMemo(() => {
    const name = survey?.business_name || 'SafariDesk';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [survey?.business_name]);

  const validateBeforeSubmit = (): boolean => {
    if (!survey) return false;
    const { questions } = survey;

    if (questions.star_required && starRating == null) {
      setValidationError('Please select a star rating.');
      return false;
    }

    if (questions.emotion_required && !emotion) {
      setValidationError('Please select how you feel about the support experience.');
      return false;
    }

    const trimmedComment = comment.trim();
    if (questions.comment_required && !trimmedComment) {
      setValidationError('Please provide a short comment.');
      return false;
    }
    if (trimmedComment.length > questions.comment_max_length) {
      setValidationError(`Comment cannot exceed ${questions.comment_max_length} characters.`);
      return false;
    }

    setValidationError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!token || !survey || submitted) return;
    if (!validateBeforeSubmit()) return;

    try {
      setSubmitting(true);
      const payload: { star_rating?: number; emotion?: Emotion; comment?: string } = {};
      if (starRating != null) payload.star_rating = starRating;
      if (emotion) payload.emotion = emotion;
      payload.comment = comment.trim();

      await http.post(`${APIS.PUBLIC_CSAT_SURVEY}${token}/submit/`, payload);
      setSubmitted(true);
    } catch (error: unknown) {
      const backendMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setValidationError(backendMessage || 'Failed to submit survey. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-surface flex items-center justify-center px-4">
        <div className="rounded-xl border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated px-6 py-5 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
          <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">Loading survey...</span>
        </div>
      </div>
    );
  }

  if (errorMessage || !survey) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-surface-elevated p-6">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">Survey unavailable</p>
          <p className="text-sm text-gray-700 dark:text-[var(--text-primary)] mt-2">{errorMessage || 'Invalid survey link.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface py-6 px-4">
      <div className="mx-auto max-w-[44rem] space-y-3.5">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 to-white px-5 py-4 dark:border-primary-900/40 dark:from-primary-900/20 dark:to-surface-elevated">
          <div className="flex items-center gap-3">
            {survey.business_logo_url ? (
              <img
                src={survey.business_logo_url}
                alt={`${survey.business_name} logo`}
                className="h-10 w-10 rounded-lg border border-slate-200 dark:border-subtle bg-white object-contain"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/60 flex items-center justify-center text-sm font-semibold text-primary-700 dark:text-primary-100">
                {logoInitials}
              </div>
            )}
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">Customer Satisfaction</p>
              <h1 className="text-[22px] font-bold text-gray-900 dark:text-[var(--text-primary)]">{survey.survey_title}</h1>
            </div>
          </div>
          <p className="mt-2.5 text-[16px] leading-6 text-gray-700 dark:text-[var(--text-primary)]">
            {survey.intro_text} <span className="font-semibold">Ticket #{survey.ticket_id}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated p-5 space-y-5 shadow-sm">
          {submitted ? (
            <div className="py-6 text-center space-y-3">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40">
                <HeartHandshake className="w-7 h-7 text-primary-600 dark:text-primary-300" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                {survey.thank_you_title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-[var(--text-muted)]">
                {survey.thank_you_message}
              </p>
            </div>
          ) : (
            <>
              {/* Q1 – Stars */}
              <div>
                <p className="text-[16px] font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                  1. {survey.questions.star_label}
                  {survey.questions.star_required ? ' *' : ''}
                </p>
                <div className="mt-3 flex items-center gap-1">
                  {[0, 1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStarRating(value)}
                      className={`p-2 rounded-lg border transition-colors ${
                        starRating != null && value <= starRating
                          ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/30'
                          : 'border-gray-200 bg-white dark:border-subtle dark:bg-surface-hover'
                      }`}
                      aria-label={`Rate ${value} stars`}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          starRating != null && value <= starRating
                            ? 'text-primary-600 dark:text-primary-300 fill-current'
                            : 'text-gray-400'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2 – Emotion */}
              <div>
                <p className="text-[16px] font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                  2. {survey.questions.emotion_label}
                  {survey.questions.emotion_required ? ' *' : ''}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEmotion('happy')}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      emotion === 'happy'
                        ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'border-gray-200 text-gray-700 dark:border-subtle dark:text-[var(--text-primary)]'
                    }`}
                  >
                    <Smile className="w-4 h-4" />
                    Happy
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmotion('sad')}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      emotion === 'sad'
                        ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'border-gray-200 text-gray-700 dark:border-subtle dark:text-[var(--text-primary)]'
                    }`}
                  >
                    <Frown className="w-4 h-4" />
                    Sad
                  </button>
                </div>
              </div>

              {/* Q3 – Comment */}
              <div>
                <p className="text-[16px] font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                  3. {survey.questions.comment_label}
                  {survey.questions.comment_required ? ' *' : ''}
                </p>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="What went well and what should we improve?"
                  className="mt-3 w-full rounded-lg border border-gray-300 dark:border-subtle bg-white dark:bg-surface-hover px-3 py-2.5 text-[14px] text-gray-900 dark:text-[var(--text-primary)] focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-[var(--text-muted)]">
                  {comment.trim().length}/{survey.questions.comment_max_length}
                </p>
              </div>

              {validationError && (
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {validationError}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60 transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CsatSurveyPage;
