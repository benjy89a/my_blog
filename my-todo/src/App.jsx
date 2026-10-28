import { useState } from "react";
// 목업 데이터는 data/ 폴더의 JSON 파일에서만 가져온다.
import initialLists from "../data/lists.json";
import initialTodos from "../data/todos.json";
import ListSidebar from "./components/ListSidebar.jsx";
import TodoPanel from "./components/TodoPanel.jsx";

// 배열에서 가장 큰 id + 1 을 새 id로 쓴다.
function nextId(items) {
  return Math.max(0, ...items.map((item) => item.id)) + 1;
}

export default function App() {
  const [lists, setLists] = useState(initialLists);
  const [todos, setTodos] = useState(initialTodos);
  const [selectedListId, setSelectedListId] = useState(initialLists[0]?.id);

  const selectedList = lists.find((list) => list.id === selectedListId);
  const listTodos = todos.filter((todo) => todo.listId === selectedListId);

  function addList(name) {
    const newList = { id: nextId(lists), name };
    setLists([...lists, newList]);
    setSelectedListId(newList.id);
  }

  function addTodo(title) {
    setTodos([...todos, { id: nextId(todos), listId: selectedListId, title, done: false }]);
  }

  function toggleTodo(id) {
    setTodos(todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)));
  }

  function deleteTodo(id) {
    setTodos(todos.filter((todo) => todo.id !== id));
  }

  function renameTodo(id, title) {
    setTodos(todos.map((todo) => (todo.id === id ? { ...todo, title } : todo)));
  }

  return (
    <div className="app">
      <ListSidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelect={setSelectedListId}
        onAdd={addList}
      />
      <TodoPanel
        list={selectedList}
        todos={listTodos}
        onAdd={addTodo}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onRename={renameTodo}
      />
    </div>
  );
}
