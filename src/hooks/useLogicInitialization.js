import { useCallback, useEffect, useState } from "react";

import { getGeneratorVersionCache, getSettingsStringCache, getStartingItemsCache, useItems } from "../context/trackerContext";
import { getActiveGame } from "../games";

const useLogicInitialization = (options = {}) => {
  const { skip = false } = options;
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { updateItemsFromLogic } = useItems();

  const initializeLogic = useCallback(async () => {
    if (skip) { return; }

    try {
      setIsLoading(true);
      setError(null);

      const version = getGeneratorVersionCache();
      const settingsString = getSettingsStringCache();
      const startingItemsString = getStartingItemsCache();

      // Load + initialize the active game's logic, resolving settings.
      const settings = await getActiveGame().initializeLogic({ version, settingsString, startingItemsString });

      updateItemsFromLogic(settings); // Starting items.
      setIsInitialized(true);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [skip, updateItemsFromLogic]);

  useEffect(() => {
    initializeLogic();
  }, [initializeLogic]);

  return { isLoading, error, isInitialized };
};

export default useLogicInitialization;
