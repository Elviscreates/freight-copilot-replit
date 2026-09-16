from typing import Any, Dict, List, Optional


class PipelineStore:
    def __init__(self) -> None:
        self._store: Dict[str, Any] = {}

    def save(self, pipeline_id: str, data: Any) -> None:
        self._store[pipeline_id] = data

    def get(self, pipeline_id: str) -> Optional[Any]:
        return self._store.get(pipeline_id)

    def delete(self, pipeline_id: str) -> bool:
        if pipeline_id in self._store:
            del self._store[pipeline_id]
            return True
        return False

    def list_pending(self) -> List[Any]:
        return list(self._store.values())

    def get_all(self) -> Dict[str, Any]:
        return dict(self._store)


store = PipelineStore()