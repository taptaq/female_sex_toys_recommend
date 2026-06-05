import { AnimatePresence } from "motion/react";
import { HomePage } from "../pages/HomePage.tsx";
import { QuizPage } from "../pages/QuizPage.tsx";
import { MatchingPage } from "../pages/MatchingPage.tsx";
import { ResultsPage } from "../pages/ResultsPage.tsx";
import { ProfilesPage } from "../pages/ProfilesPage.tsx";
import { KnowledgeNebulaPage } from "../pages/KnowledgeNebulaPage.tsx";
import type { AnswerState, Product, Question } from "../data/mock.ts";
import type { AppThemeId } from "../lib/app-theme.ts";
import type { RankedProduct } from "../lib/app-shell.ts";
import type { BackupCandidate } from "../lib/recommendation-results.ts";
import type { SavedRecommendationProfile } from "../lib/user-recommendation-profile.ts";
import type { AuthPanelMode } from "../components/AuthPanel.tsx";
import type { KnowledgeNebulaTopicSlug } from "../data/knowledge-nebula.ts";

type AppRouteRendererProps = {
  currentRoute: string;
  pageVariants: any;
  step: number;
  activeQuestions: Question[];
  isAiMatching: boolean;
  answers: AnswerState;
  topProducts: RankedProduct[];
  backupProducts: BackupCandidate[];
  shoppingGuidance: string[];
  recommendationTips: string[];
  isEnhancingResults?: boolean;
  isRecalibratingResults: boolean;
  onStart: () => void;
  onBrowseLibraryHome: () => void;
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
  onReloadRecommendationProfiles: () => void;
  authPanel: {
    isConfigured: boolean;
    userLabel: string | null;
    statusMessage: string | null;
    isSubmitting: boolean;
    onSubmit: (mode: AuthPanelMode, email: string, password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  };
  recommendationProfiles: SavedRecommendationProfile[];
  isLoadingRecommendationProfiles: boolean;
  recommendationProfilesError: string | null;
  allProducts: Product[];
  selectedKnowledgeTopicSlug?: KnowledgeNebulaTopicSlug;
  selectedKnowledgeSectionId?: string;
  onBackKnowledge: () => void;
  onSelectKnowledgeTopic: (topicSlug: KnowledgeNebulaTopicSlug) => void;
  themeId: AppThemeId;
  onThemeChange: (nextThemeId: AppThemeId) => void;
  onReset: () => void;
  matchInputMode?: "quiz" | "natural-language";
  naturalLanguageQuery?: string;
  shouldPlayQuizLanding?: boolean;
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
  topProducts,
  backupProducts,
  shoppingGuidance,
  recommendationTips,
  isEnhancingResults = false,
  isRecalibratingResults,
  onStart,
  onBrowseLibraryHome,
  onOpenKnowledgeNebula,
  onOpenProfiles,
  onOpenFavorites,
  onBackProfiles,
  onSelectOption,
  onBackQuestion,
  onBackHome,
  onBackResults,
  onJumpToQuestion,
  onReloadRecommendationProfiles,
  authPanel,
  recommendationProfiles,
  isLoadingRecommendationProfiles,
  recommendationProfilesError,
  allProducts,
  selectedKnowledgeTopicSlug,
  selectedKnowledgeSectionId,
  onBackKnowledge,
  onSelectKnowledgeTopic,
  themeId,
  onThemeChange,
  onReset,
  matchInputMode = "quiz",
  naturalLanguageQuery = "",
  shouldPlayQuizLanding = false,
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
            shouldPlayLanding={shouldPlayQuizLanding}
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
          topProducts={topProducts}
          backupProducts={backupProducts}
          shoppingGuidance={shoppingGuidance}
          recommendationTips={recommendationTips}
          isEnhancingResults={isEnhancingResults}
          isRecalibratingResults={isRecalibratingResults}
          onBackHome={onBackHome}
          onReset={onReset}
          matchInputMode={matchInputMode}
          naturalLanguageQuery={naturalLanguageQuery}
          favoriteProductIds={favoriteProductIds}
          onToggleFavorite={onToggleFavorite}
        />
      )}

      {currentRoute === "/profiles" && (
        <ProfilesPage
          profiles={recommendationProfiles}
          products={allProducts}
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
