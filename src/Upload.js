import { useParams } from "react-router-dom";
import { SupportedProviders } from "./constants";

function Upload() {
  const params = useParams();
  const provider = SupportedProviders.find(p => p.slug === params.provider);
  return (
    <div className="Upload">
      <div className="instructions">Upload data from {provider.displayName}...</div>
      <input type="file" />
    </div>
  );
}

export default Upload;
