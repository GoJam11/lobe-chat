import { uniqBy } from 'lodash-es';

import {
  AnthropicProviderCard,
  AzureProviderCard,
  BedrockProviderCard,
  GoogleProviderCard,
  GroqProviderCard,
  MistralProviderCard,
  MoonshotProviderCard,
  OllamaProviderCard,
  OpenAIProviderCard,
  OpenRouterProviderCard,
  PerplexityProviderCard,
  TogetherAIProviderCard,
  ZeroOneProviderCard,
  ZhiPuProviderCard,
  filterEnabledModels,
} from '@/config/modelProviders';
import { ChatModelCard, ModelProviderCard } from '@/types/llm';
import { ServerModelProviderConfig } from '@/types/serverConfig';
import { GlobalLLMProviderKey } from '@/types/settings';

import { GlobalStore } from '../../../store';
import { currentSettings, getProviderConfigById } from './settings';

/**
 * get the server side model cards
 */
const serverProviderModelCards =
  (provider: GlobalLLMProviderKey) =>
  (s: GlobalStore): ChatModelCard[] | undefined => {
    const config = s.serverConfig.languageModel?.[provider] as
      | ServerModelProviderConfig
      | undefined;

    if (!config) return;

    return config.serverModelCards;
  };

const remoteProviderModelCards =
  (provider: GlobalLLMProviderKey) =>
  (s: GlobalStore): ChatModelCard[] | undefined => {
    const cards = currentSettings(s).languageModel?.[provider]?.remoteModelCards as
      | ChatModelCard[]
      | undefined;

    if (!cards) return;

    return cards;
  };

const isProviderEnabled = (provider: GlobalLLMProviderKey) => (s: GlobalStore) =>
  getProviderConfigById(provider)(s)?.enabled || false;

// Default Model Provider List

/**
 * define all the model list of providers
 */
const defaultModelProviderList = (s: GlobalStore): ModelProviderCard[] => {
  /**
   * Because we have several model cards sources, we need to merge the model cards
   * the priority is below:
   * 1 - server side model cards
   * 2 - remote model cards
   * 3 - default model cards
   */

  const mergeModels = (provider: GlobalLLMProviderKey, defaultChatModels: ChatModelCard[]) => {
    // if the chat model is config in the server side, use the server side model cards
    const serverChatModels = serverProviderModelCards(provider)(s);
    const remoteChatModels = remoteProviderModelCards(provider)(s);

    return serverChatModels ?? remoteChatModels ?? defaultChatModels;
  };

  return [
    {
      ...OpenAIProviderCard,
      chatModels: mergeModels('openai', OpenAIProviderCard.chatModels),
    },
    { ...AzureProviderCard, chatModels: mergeModels('azure', []) },
    { ...OllamaProviderCard, chatModels: mergeModels('ollama', OllamaProviderCard.chatModels) },
    AnthropicProviderCard,
    GoogleProviderCard,
    {
      ...OpenRouterProviderCard,
      chatModels: mergeModels('openrouter', OpenRouterProviderCard.chatModels),
    },
    {
      ...TogetherAIProviderCard,
      chatModels: mergeModels('togetherai', TogetherAIProviderCard.chatModels),
    },
    BedrockProviderCard,
    PerplexityProviderCard,
    MistralProviderCard,
    GroqProviderCard,
    MoonshotProviderCard,
    ZeroOneProviderCard,
    ZhiPuProviderCard,
  ];
};

export const getDefaultModeProviderById = (provider: string) => (s: GlobalStore) =>
  defaultModelProviderList(s).find((s) => s.id === provider);

/**
 * get the default enabled models for a provider
 * it's a default enabled model list by Lobe Chat
 * e.g. openai is ['gpt-3.5-turbo','gpt-4-turbo']
 */
const getDefaultEnabledModelsById = (provider: string) => (s: GlobalStore) => {
  const modelProvider = getDefaultModeProviderById(provider)(s);

  if (modelProvider) return filterEnabledModels(modelProvider);

  return undefined;
};

const getDefaultModelCardById = (id: string) => (s: GlobalStore) => {
  const list = defaultModelProviderList(s);

  return list.flatMap((i) => i.chatModels).find((m) => m.id === id);
};

// Model Provider List

const getModelCardsById =
  (provider: string) =>
  (s: GlobalStore): ChatModelCard[] => {
    const builtinCards = getDefaultModeProviderById(provider)(s)?.chatModels || [];

    const userCards = (getProviderConfigById(provider)(s)?.customModelCards || []).map((model) => ({
      ...model,
      isCustom: true,
    }));

    return uniqBy([...userCards, ...builtinCards], 'id');
  };

const getEnableModelsById = (provider: string) => (s: GlobalStore) => {
  if (!getProviderConfigById(provider)(s)?.enabledModels) return;

  return getProviderConfigById(provider)(s)?.enabledModels?.filter(Boolean);
};

const modelProviderList = (s: GlobalStore): ModelProviderCard[] =>
  defaultModelProviderList(s).map((list) => ({
    ...list,
    chatModels: getModelCardsById(list.id)(s)?.map((model) => {
      const models = getEnableModelsById(list.id)(s);

      if (!models) return model;

      return {
        ...model,
        enabled: models?.some((m) => m === model.id),
      };
    }),
    enabled: isProviderEnabled(list.id as any)(s),
  }));

const modelProviderListForModelSelect = (s: GlobalStore): ModelProviderCard[] =>
  modelProviderList(s)
    .filter((s) => s.enabled)
    .map((provider) => ({
      ...provider,
      chatModels: provider.chatModels.filter((model) => model.enabled),
    }));

const getModelCardById = (id: string) => (s: GlobalStore) => {
  const list = modelProviderList(s);

  return list.flatMap((i) => i.chatModels).find((m) => m.id === id);
};

const isModelEnabledFunctionCall = (id: string) => (s: GlobalStore) =>
  getModelCardById(id)(s)?.functionCall || false;

// vision model white list, these models will change the content from string to array
// refs: https://github.com/lobehub/lobe-chat/issues/790
const isModelEnabledVision = (id: string) => (s: GlobalStore) =>
  getModelCardById(id)(s)?.vision || id.includes('vision');

const isModelEnabledFiles = (id: string) => (s: GlobalStore) => getModelCardById(id)(s)?.files;

const isModelEnabledUpload = (id: string) => (s: GlobalStore) =>
  isModelEnabledVision(id)(s) || isModelEnabledFiles(id)(s);

const isModelHasMaxToken = (id: string) => (s: GlobalStore) =>
  typeof getModelCardById(id)(s)?.tokens !== 'undefined';

const modelMaxToken = (id: string) => (s: GlobalStore) => getModelCardById(id)(s)?.tokens || 0;

export const modelProviderSelectors = {
  defaultModelProviderList,

  getDefaultEnabledModelsById,
  getDefaultModelCardById,

  getEnableModelsById,
  getModelCardById,
  getModelCardsById,

  isModelEnabledFiles,
  isModelEnabledFunctionCall,
  isModelEnabledUpload,
  isModelEnabledVision,
  isModelHasMaxToken,

  modelMaxToken,

  modelProviderList,
  modelProviderListForModelSelect,
};
