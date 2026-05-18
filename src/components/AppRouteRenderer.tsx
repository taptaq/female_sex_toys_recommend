import { AnimatePresence } from "motion/react";
import { HomePage } from "../pages/HomePage.tsx";
import { QuizPage } from "../pages/QuizPage.tsx";
import { MatchingPage } from "../pages/MatchingPage.tsx";
import { ResultsPage, type ResultEditableCondition } from "../pages/ResultsPage.tsx";
import { ProfilesPage } from "../pages/ProfilesPage.tsx";
import { KnowledgeNebulaPage } from "../pages/KnowledgeNebulaPage.tsx";
import type { AnswerState, Product, Question } from "../data/mock.ts";
import type { AppThemeId } from "../lib/app-theme.ts";
import type { RankedProduct } from "../lib/app-shell.ts";
import type { BackupCandidate } from "../lib/recommendation-results.ts";
import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";
import type {
  BodyPersonaAnswerValue,
  BodyPersonaAnswers,
  BodyPersonaQuestion,
  BodyPersonaQuestionId,
  BodyPersonaResult,
} from "../lib/body-persona.ts";
import type { ResultTuningMode } from "../lib/result-tuning.ts";
import type { SavedRecommendationProfile } from "../lib/user-recommendation-profile.ts";
import type { AuthPanelMode } from "../components/AuthPanel.tsx";
import type { KnowledgeNebulaTopicSlug } from "../data/knowledge-nebula.ts";
import type { RecommendationRerollReason } from "../lib/recommendation-reroll.ts";

type BodyPersonaPageState = {
  sessionId: string;
  status: "idle" | "completed_free" | "unlocking" | "unlocked";
  freeSummary: BodyPersonaResult["freeSummary"] | null;
  fullReport: BodyPersonaFullReport | null;
};

type AppRouteRendererProps = {
  currentRoute: string;
  pageVariants: any;
  step: number;
  activeQuestions: Question[];
  isAiMatching: boolean;
  answers: AnswerState;
  appliedResultTuningModes?: ResultTuningMode[];
  topProducts: RankedProduct[];
  backupProducts: BackupCandidate[];
  shoppingGuidance: string[];
  recommendationTips: string[];
  bodyPersonaState?: BodyPersonaPageState | null;
  isStartingBodyPersona?: boolean;
  isBodyPersonaQuizOpen?: boolean;
  bodyPersonaQuestions?: readonly BodyPersonaQuestion[];
  bodyPersonaDraftAnswers?: BodyPersonaAnswers;
  isSubmittingBodyPersonaQuiz?: boolean;
  isUnlockingBodyPersona?: boolean;
  isEnhancingResults?: boolean;
  isRecalibratingResults: boolean;
  resultRecalibrationError: string | null;
  onStart: () => void;
  onStartBodyPersona: () => void;
  onBrowseLibraryHome: () => void;
  onBrowseLibraryResults: (product?: RankedProduct) => void;
  onOpenKnowledgeNebula: (path?: string) => void;
  onOpenProfiles: () => void;
  onOpenFavorites: () => void;
  onBackProfiles: () => void;
  onSelectOption: (
    field: keyof AnswerState,
    value: AnswerState[keyof AnswerState],
    tag: string,
    answerPatch?: Partial<Omit<AnswerState, "tags">>,
    optionLabel?: string,
  ) => void;
  onBackQuestion: () => void;
  onBackHome: () => void;
  onBackResults?: () => void;
  onJumpToQuestion?: (questionIndex: number) => void;
  onCloseBodyPersonaQuiz?: () => void;
  onChangeBodyPersonaAnswer?: (
    questionId: BodyPersonaQuestionId,
    value: BodyPersonaAnswerValue,
  ) => void;
  onSubmitBodyPersonaQuiz?: () => void | Promise<void>;
  onUnlockBodyPersona?: () => void | Promise<void>;
  onOpenBodyPersonaFullReport?: () => void;
  onCloseBodyPersonaFullReport?: () => void;
  onRecalibrateResults: (reason: RecommendationRerollReason) => void;
  onTuneResults: (mode: ResultTuningMode) => void;
  onEditQuizCondition?: (condition: ResultEditableCondition) => void;
  onSaveRecommendationProfile: () => Promise<void>;
  onOpenRecommendationProfiles: () => void;
  onReloadRecommendationProfiles: () => void;
  isSavingRecommendationProfile: boolean;
  saveRecommendationProfileMessage: string | null;
  authPanel: {
    isConfigured: boolean;
    userLabel: string | null;
    statusMessage: string | null;
    isSubmitting: boolean;
    onSubmit: (mode: AuthPanelMode, username: string, password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  };
  isBodyPersonaUnlockLoginRequired?: boolean;
  isBodyPersonaFullReportOpen?: boolean;
  recommendationProfiles: SavedRecommendationProfile[];
  isLoadingRecommendationProfiles: boolean;
  recommendationProfilesError: string | null;
  selectedKnowledgeTopicSlug?: KnowledgeNebulaTopicSlug;
  selectedKnowledgeSectionId?: string;
  onBackKnowledge: () => void;
  onSelectKnowledgeTopic: (topicSlug: KnowledgeNebulaTopicSlug) => void;
  themeId: AppThemeId;
  onThemeChange: (nextThemeId: AppThemeId) => void;
  onReset: () => void;
  favoriteProductIds: Set<string>;
  onToggleFavorite: (product: Product) => void | Promise<void>;
};

export function AppRouteRenderer({
  currentRoute,
  pageVariants,
  step,
  activeQuestions,
  isAiMatching,
  answers,
  appliedResultTuningModes,
  topProducts,
  backupProducts,
  shoppingGuidance,
  recommendationTips,
  bodyPersonaState,
  isStartingBodyPersona = false,
  isBodyPersonaQuizOpen = false,
  bodyPersonaQuestions = [],
  bodyPersonaDraftAnswers = {},
  isSubmittingBodyPersonaQuiz = false,
  isUnlockingBodyPersona = false,
  isEnhancingResults = false,
  isRecalibratingResults,
  resultRecalibrationError,
  onStart,
  onStartBodyPersona,
  onBrowseLibraryHome,
  onBrowseLibraryResults,
  onOpenKnowledgeNebula,
  onOpenProfiles,
  onOpenFavorites,
  onBackProfiles,
  onSelectOption,
  onBackQuestion,
  onBackHome,
  onBackResults,
  onJumpToQuestion,
  onCloseBodyPersonaQuiz,
  onChangeBodyPersonaAnswer,
  onSubmitBodyPersonaQuiz,
  onUnlockBodyPersona,
  onOpenBodyPersonaFullReport,
  onCloseBodyPersonaFullReport,
  onRecalibrateResults,
  onTuneResults,
  onEditQuizCondition,
  onSaveRecommendationProfile,
  onOpenRecommendationProfiles,
  onReloadRecommendationProfiles,
  isSavingRecommendationProfile,
  saveRecommendationProfileMessage,
  authPanel,
  isBodyPersonaUnlockLoginRequired,
  isBodyPersonaFullReportOpen = false,
  recommendationProfiles,
  isLoadingRecommendationProfiles,
  recommendationProfilesError,
  selectedKnowledgeTopicSlug,
  selectedKnowledgeSectionId,
  onBackKnowledge,
  onSelectKnowledgeTopic,
  themeId,
  onThemeChange,
  onReset,
  favoriteProductIds,
  onToggleFavorite,
}: AppRouteRendererProps) {
  return (
    <AnimatePresence mode="wait">
      {currentRoute === "/" && (
        <HomePage
          pageVariants={pageVariants}
          onStart={onStart}
          onBrowseLibrary={onBrowseLibraryHome}
          onOpenKnowledgeNebula={() => {
            onOpenKnowledgeNebula();
          }}
          onOpenProfiles={onOpenProfiles}
          onOpenFavorites={onOpenFavorites}
          themeId={themeId}
          onThemeChange={onThemeChange}
          authPanel={authPanel}
        />
      )}

      {currentRoute === "/quiz" &&
        step >= 0 &&
        step < activeQuestions.length && (
          <QuizPage
            pageVariants={pageVariants}
            step={step}
            activeQuestions={activeQuestions}
            onSelectOption={onSelectOption}
            onBackQuestion={onBackQuestion}
            onBackHome={onBackHome}
            onBackResults={onBackResults}
            onJumpToQuestion={onJumpToQuestion}
          />
        )}

      {currentRoute === "/quiz" && step === activeQuestions.length && (
        <MatchingPage
          pageVariants={pageVariants}
          isAiMatching={isAiMatching}
          tags={answers.tags}
        />
      )}

      {currentRoute === "/results" && (
        <ResultsPage
          pageVariants={pageVariants}
          answers={answers}
          appliedResultTuningModes={appliedResultTuningModes}
          topProducts={topProducts}
          backupProducts={backupProducts}
          shoppingGuidance={shoppingGuidance}
          recommendationTips={recommendationTips}
          bodyPersonaState={bodyPersonaState}
          isStartingBodyPersona={isStartingBodyPersona}
          isBodyPersonaQuizOpen={isBodyPersonaQuizOpen}
          bodyPersonaQuestions={bodyPersonaQuestions}
          bodyPersonaDraftAnswers={bodyPersonaDraftAnswers}
          isSubmittingBodyPersonaQuiz={isSubmittingBodyPersonaQuiz}
          isUnlockingBodyPersona={isUnlockingBodyPersona}
          isEnhancingResults={isEnhancingResults}
          isRecalibratingResults={isRecalibratingResults}
          resultRecalibrationError={resultRecalibrationError}
          onStartBodyPersona={onStartBodyPersona}
          onCloseBodyPersonaQuiz={onCloseBodyPersonaQuiz}
          onChangeBodyPersonaAnswer={onChangeBodyPersonaAnswer}
          onSubmitBodyPersonaQuiz={onSubmitBodyPersonaQuiz}
          onUnlockBodyPersona={onUnlockBodyPersona}
          onOpenBodyPersonaFullReport={onOpenBodyPersonaFullReport}
          onCloseBodyPersonaFullReport={onCloseBodyPersonaFullReport}
          onRecalibrateResults={onRecalibrateResults}
          onTuneResults={onTuneResults}
          onEditQuizCondition={onEditQuizCondition}
          onBrowseLibrary={onBrowseLibraryResults}
          onSaveRecommendationProfile={onSaveRecommendationProfile}
          onOpenRecommendationProfiles={onOpenRecommendationProfiles}
          onOpenKnowledgeNebula={onOpenKnowledgeNebula}
          isSavingRecommendationProfile={isSavingRecommendationProfile}
          saveRecommendationProfileMessage={saveRecommendationProfileMessage}
          authPanel={authPanel}
          onBackHome={onBackHome}
          onReset={onReset}
          isBodyPersonaUnlockLoginRequired={isBodyPersonaUnlockLoginRequired}
          isBodyPersonaFullReportOpen={isBodyPersonaFullReportOpen}
          favoriteProductIds={favoriteProductIds}
          onToggleFavorite={onToggleFavorite}
        />
      )}

      {currentRoute === "/profiles" && (
        <ProfilesPage
          profiles={recommendationProfiles}
          isLoading={isLoadingRecommendationProfiles}
          error={recommendationProfilesError}
          userLabel={authPanel.userLabel}
          onBack={onBackProfiles}
          onReload={onReloadRecommendationProfiles}
        />
      )}

      {currentRoute === "/knowledge" && (
        <KnowledgeNebulaPage
          pageVariants={pageVariants}
          topicSlug={selectedKnowledgeTopicSlug}
          sectionId={selectedKnowledgeSectionId}
          onBack={onBackKnowledge}
          onSelectTopic={onSelectKnowledgeTopic}
        />
      )}
    </AnimatePresence>
  );
}
