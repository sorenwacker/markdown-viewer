cask "markdown-viewer" do
  version "1.5.0"
  sha256 "de22da5116960cb36bce05b1f5aaca873e9419ae525ec6b7773b0ed0679745ca"

  url "https://github.com/sorenwacker/markdown-viewer/releases/download/v#{version}/markdown-viewer-#{version}-arm64.zip"
  name "Markdown Viewer"
  desc "Cross-platform markdown viewer with mermaid diagram support"
  homepage "https://github.com/sorenwacker/markdown-viewer"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Markdown Viewer.app"

  zap trash: [
    "~/Library/Application Support/markdown-viewer",
    "~/Library/Preferences/com.markdown-viewer.app.plist",
    "~/Library/Saved Application State/com.markdown-viewer.app.savedState",
  ]
end
