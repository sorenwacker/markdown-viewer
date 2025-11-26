!macro customInstall
  ; File association checkbox is handled by electron-builder's fileAssociations
  ; This script adds additional customization if needed
!macroend

!macro customUnInstall
  ; Clean up file associations on uninstall
  DeleteRegKey HKCU "Software\Classes\.md"
  DeleteRegKey HKCU "Software\Classes\.markdown"
  DeleteRegKey HKCU "Software\Classes\.mdown"
  DeleteRegKey HKCU "Software\Classes\.mkd"
  DeleteRegKey HKCU "Software\Classes\MarkdownViewer.md"
!macroend
