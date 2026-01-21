cask "markdown-viewer" do
  version "1.1.0"
  sha256 "f6b162934d18a2fbbcf3661f7af4a1cff9507731072d3e5bb30e9492989ae2c0"

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
