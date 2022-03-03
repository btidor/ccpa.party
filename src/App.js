import './App.css';

const SUPPORTED_PROVIDERS = [
  'Slack', 'Google', 'Facebook', 'Amazon',
];

function App() {
  return (
    <div className="App">
      <h1 className="App-header">
        <a href="#">🎉 ccpa.party</a>
      </h1>
      <section>
        Upload data from...
        <ul>
          {SUPPORTED_PROVIDERS.map(provider =>
            <li><a href="#">{provider}</a></li>
          )}
        </ul>
      </section>
    </div>
  );
}

export default App;
