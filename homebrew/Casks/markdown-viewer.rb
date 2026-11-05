cask "markdown-viewer" do
  version "1.5.1"
  sha256 "99047c3ac16b48f692a5f395bcd9a7878348b88cf2f57dbd8704208ff99fc103"

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
