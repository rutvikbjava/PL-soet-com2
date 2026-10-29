# Upload Your Report to Overleaf - Step by Step

## Why Overleaf?
- ✅ No installation needed
- ✅ Compiles automatically
- ✅ Works on any device
- ✅ Free account sufficient
- ✅ Auto-saves your work
- ✅ Can share with guide for review

## Steps to Upload and Compile

### Step 1: Create Overleaf Account
1. Go to: **https://www.overleaf.com**
2. Click "Register" (top right)
3. Sign up with your email (free account is fine)
4. Verify your email

### Step 2: Prepare Report Folder for Upload
1. Open File Explorer
2. Navigate to: `d:\GRADUATE_accademics\final-year\second-prot\report`
3. Select ALL files and folders INSIDE the report folder:
   - main.tex
   - chapters/ folder
   - images/ folder
   - All .md files
4. Right-click → "Send to" → "Compressed (zipped) folder"
5. Name it: `EduSphere_Report.zip`

### Step 3: Upload to Overleaf
1. Log into Overleaf
2. Click "New Project" (green button, top left)
3. Select "Upload Project"
4. Click "Select a .zip file"
5. Choose `EduSphere_Report.zip`
6. Wait for upload to complete

### Step 4: Set Main Document
1. Project opens automatically
2. Click on "Menu" (top left, three horizontal lines)
3. Under "Main document", select: **main.tex**
4. Click "Recompile" button

### Step 5: First Compilation
1. Click the green "Recompile" button
2. Wait ~30-60 seconds
3. You'll see a PDF preview on the right side
4. **Important:** Click "Recompile" again (2nd time)
   - This updates the Table of Contents properly

### Step 6: Review the PDF
Look for:
- [ ] Cover page with your details
- [ ] Table of Contents (should have page numbers after 2nd compile)
- [ ] All 8 chapters present
- [ ] References section
- [ ] Appendices

### Step 7: Add Your Screenshots
1. In Overleaf, click "Upload" icon (top left, near file tree)
2. Select "images" folder first
3. Upload your screenshots one by one
4. After each upload, click "Recompile" to see it in PDF

### Step 8: Download Final PDF
1. Once satisfied, click "Download PDF" (next to Recompile button)
2. Or click "Menu" → "Download" → "PDF"
3. File will be named: `main.pdf`
4. Rename it to: `EduSphere_AI_Final_Report_YourName.pdf`

## Before You Upload - Update These Files

### 1. Update Cover Page
File: `chapters/00_cover.tex`

Find and replace:
```latex
[Your Name Here] → Your actual name
[Your Roll Number] → Your roll number
[Guide Name] → Your guide's name
[Month Year] → Current month and year
```

### 2. Update Certificates
File: `chapters/01_certificates.tex`

Update:
- Student name and roll number
- Guide name and designation
- HOD name

### 3. Update Acknowledgements
File: `chapters/02_acknowledgement.tex`

Personalize the acknowledgement section with your own words.

## Troubleshooting on Overleaf

### If compilation fails:
1. Check the "Logs and output files" (red icon if errors)
2. Common issues:
   - Missing image files: Comment out `\includegraphics` lines temporarily
   - Syntax error: Check recent edits
   - Timeout: Project too large, reduce image file sizes

### If images don't show:
1. Make sure images are in `images/` folder in Overleaf
2. Check image filename matches exactly (case-sensitive)
3. Supported formats: PNG, JPG, PDF
4. Max file size per image: ~5MB

### If Table of Contents is empty:
1. Click "Recompile" button 2-3 times
2. LaTeX needs multiple passes to build TOC

## Pro Tips

### Collaborate with Your Guide
1. Click "Share" button (top right)
2. Enter guide's email
3. They can view and comment on your report

### Keep Backup
1. Menu → Download → Source (downloads all .tex files)
2. Keep backup on your computer

### Make Changes Easily
1. Click any .tex file in left panel
2. Edit directly in Overleaf
3. Click "Recompile" to see changes
4. Changes save automatically

### Fast Compilation
1. Menu → "Settings"
2. Set "Compiler" to "pdfLaTeX" (should be default)
3. Set "Auto Compile" to "On" (compiles as you type)

## Quick Checklist Before Final Submission

- [ ] Personal details updated (name, roll no)
- [ ] Guide and HOD names updated
- [ ] All 10+ screenshots added to images folder
- [ ] Table of Contents shows page numbers
- [ ] All chapters compile without errors
- [ ] References are properly formatted
- [ ] PDF downloads successfully
- [ ] Printed copy looks professional
- [ ] Physical signatures obtained from guide and HOD

## Need Help?

- Overleaf Documentation: https://www.overleaf.com/learn
- LaTeX Wikibook: https://en.wikibooks.org/wiki/LaTeX
- Overleaf Support: support@overleaf.com

## Estimated Time

- First-time setup: 15 minutes
- Adding screenshots: 30 minutes
- Review and edits: 1 hour
- **Total: ~2 hours to complete PDF**

Good luck! 🎓
