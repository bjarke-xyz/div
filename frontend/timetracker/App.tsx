import { useStoreRehydrated } from "easy-peasy";
import { useEffect } from "react";
import { Input } from "./components/Input";
import { Results } from "./components/Results";
import { useStoreActions, useStoreState } from "./store/hooks";
import { parseQueryParams } from "./utils/query-params";

const App: React.FC = () => {
  const isRehydrated = useStoreRehydrated();

  const tasks = useStoreState((state) => state.tasks);
  const actions = useStoreActions((actions) => actions);

  useEffect(() => {
    if (isRehydrated) {
      const parsedQueryParams = parseQueryParams();
      if (parsedQueryParams.q) {
        actions.set(parsedQueryParams.q);
      } else if (tasks.length === 0) {
        actions.newTask();
      } else {
        // Tasks in persistance is used
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRehydrated]);

  return (
    <>
      <div className="container">
        {isRehydrated ? (
          <div>
            <div className="row">
              <div className="column">
                <Input />
              </div>
              <div className="column">
                <Results />
              </div>
            </div>
          </div>
        ) : (
          <div>Loading...</div>
        )}
      </div>
    </>
  );
};

export default App;
