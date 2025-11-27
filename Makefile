.PHONY: help build clean install icons dmg associate

# Default target
help:
	@echo "Markdown Viewer - Build Commands"
	@echo ""
	@echo "Available targets:"
	@echo "  make icons     - Generate app icons from SVG"
	@echo "  make build     - Build the Electron app for macOS"
	@echo "  make dmg       - Build the DMG installer (alias for build)"
	@echo "  make install   - Install the app to /Applications (prompts for file association)"
	@echo "  make associate - Set .md file associations (requires duti)"
	@echo "  make clean     - Remove build artifacts"
	@echo "  make all       - Generate icons and build DMG"

# Generate icons from SVG
icons:
	@echo "Generating app icons..."
	@mkdir -p build/icon.iconset
	@magick icon.svg -resize 16x16 build/icon.iconset/icon_16x16.png
	@magick icon.svg -resize 32x32 build/icon.iconset/icon_16x16@2x.png
	@magick icon.svg -resize 32x32 build/icon.iconset/icon_32x32.png
	@magick icon.svg -resize 64x64 build/icon.iconset/icon_32x32@2x.png
	@magick icon.svg -resize 128x128 build/icon.iconset/icon_128x128.png
	@magick icon.svg -resize 256x256 build/icon.iconset/icon_128x128@2x.png
	@magick icon.svg -resize 256x256 build/icon.iconset/icon_256x256.png
	@magick icon.svg -resize 512x512 build/icon.iconset/icon_256x256@2x.png
	@magick icon.svg -resize 512x512 build/icon.iconset/icon_512x512.png
	@magick icon.svg -resize 1024x1024 build/icon.iconset/icon_512x512@2x.png
	@iconutil -c icns build/icon.iconset -o build/icon.icns
	@magick icon.svg -define icon:auto-resize=256,128,96,64,48,32,16 build/icon.ico
	@magick icon.svg -resize 1024x1024 -background none icon.png
	@echo "Icons generated successfully"

# Build the macOS app
build:
	@echo "Building Markdown Viewer for macOS..."
	@npm run build:mac
	@echo "Build complete!"
	@echo ""
	@echo "DMG installer created at: dist/markdown-viewer-$$(node -p "require('./package.json').version")-arm64.dmg"

# Alias for build
dmg: build

# Install to Applications folder
install:
	@echo "Installing Markdown Viewer to /Applications..."
	@cp -R "dist/mac-arm64/Markdown Viewer.app" "/Applications/Markdown Viewer.app"
	@echo "Installed successfully"
	@echo ""
	@echo "Refreshing Launch Services database..."
	@/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user 2>/dev/null || true
	@echo ""
	@read -p "Associate .md files with Markdown Viewer? [y/N] " response; \
	if [ "$$response" = "y" ] || [ "$$response" = "Y" ]; then \
		echo "Setting file associations..."; \
		if command -v duti >/dev/null 2>&1; then \
			duti -s com.markdown-viewer.app .md all; \
			duti -s com.markdown-viewer.app .markdown all; \
			duti -s com.markdown-viewer.app .mdown all; \
			duti -s com.markdown-viewer.app .mkd all; \
			echo "File associations set"; \
		else \
			echo "Note: Install 'duti' with 'brew install duti' to set file associations"; \
			echo "Then run: make associate"; \
		fi \
	else \
		echo "Skipped file associations. Run 'make associate' later if needed."; \
	fi

# Set file associations (requires duti: brew install duti)
associate:
	@echo "Setting file associations..."
	@if command -v duti >/dev/null 2>&1; then \
		duti -s com.markdown-viewer.app .md all; \
		duti -s com.markdown-viewer.app .markdown all; \
		duti -s com.markdown-viewer.app .mdown all; \
		duti -s com.markdown-viewer.app .mkd all; \
		echo "File associations set"; \
	else \
		echo "Error: duti is not installed. Run: brew install duti"; \
		exit 1; \
	fi

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist
	@rm -rf build/icon.iconset
	@echo "Clean complete"

# Build everything
all: icons build
	@echo ""
	@echo "All tasks complete!"
