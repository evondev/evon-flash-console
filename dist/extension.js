"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
function activate(context) {
  const disposable = vscode.commands.registerCommand(
    "evon-flash-console.insertConsoleLog",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor!");
        return;
      }
      const document = editor.document;
      const selection = editor.selection;
      let variableName;
      if (!selection.isEmpty) {
        variableName = document.getText(selection).trim();
      } else {
        const position = selection.active;
        const wordRange = document.getWordRangeAtPosition(position);
        if (wordRange) {
          variableName = document.getText(wordRange).trim();
        }
      }
      if (!variableName || !/^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(variableName)) {
        vscode.window.showErrorMessage(
          "No valid variable name selected or under cursor!"
        );
        return;
      }
      let isSingleLine = false;
      const currentLine = selection.active.line;
      const lineText = document.lineAt(currentLine).text;
      const trimmedLine = lineText.trim();
      if (/\s{\s*$/.test(trimmedLine) || /;\s*$/.test(trimmedLine)) {
        isSingleLine = true;
      }
      let declarationLine = currentLine;
      let endLine = currentLine;
      let braceCount = 0;
      let parenCount = 0;
      let bracketCount = 0;
      let inArrowFunction = false;
      let isBlockDeclaration = false;
      let foundEnd = false;
      let variableDeclarationFound = false;
      let declarationContent = "";
      for (let i = currentLine; i >= 0; i--) {
        const lineText2 = document.lineAt(i).text;
        const trimmedLine2 = lineText2.trim();
        if (trimmedLine2.match(/^(const|let|var)\s/)) {
          declarationLine = i;
          declarationContent = lineText2;
          let j = i + 1;
          while (j < document.lineCount) {
            const nextLineText = document.lineAt(j).text;
            declarationContent += "\n" + nextLineText;
            const trimmedNextLine = nextLineText.trim();
            if (trimmedNextLine.endsWith(";") || trimmedNextLine.includes("}")) {
              break;
            }
            j++;
          }
          if (declarationContent.includes(variableName)) {
            variableDeclarationFound = true;
            break;
          }
        }
        if (trimmedLine2.includes("{")) {
          isBlockDeclaration = true;
        }
        if (trimmedLine2.endsWith(";") || trimmedLine2.includes("}")) {
          break;
        }
      }
      const declarationLineText = document.lineAt(declarationLine).text.trim();
      if (
        // declarationLineText.includes("=>") ||
        declarationLineText.includes("{")
      ) {
        isBlockDeclaration = true;
      }
      endLine = declarationLine;
      while (endLine < document.lineCount) {
        const lineText2 = document.lineAt(endLine).text;
        const trimmedLine2 = lineText2.trim();
        for (let i = 0; i < lineText2.length; i++) {
          const char = lineText2[i];
          if (char === "{") {
            braceCount++;
          } else if (char === "}") {
            braceCount--;
          } else if (char === "(") {
            parenCount++;
          } else if (char === ")") {
            parenCount--;
          } else if (char === "[") {
            bracketCount++;
          } else if (char === "]") {
            bracketCount--;
          } else if (char === "=" && i + 1 < lineText2.length && lineText2[i + 1] === ">" && !inArrowFunction) {
            inArrowFunction = true;
            i++;
          }
        }
        if (braceCount === 0 && parenCount === 0 && bracketCount === 0 && !inArrowFunction) {
          if (isBlockDeclaration) {
            if (trimmedLine2.includes("}")) {
              foundEnd = true;
              break;
            }
          } else if (trimmedLine2.endsWith(";")) {
            foundEnd = true;
            break;
          } else if (endLine > declarationLine) {
            const nextLineText = endLine + 1 < document.lineCount ? document.lineAt(endLine + 1).text.trim() : "";
            if (
              // !nextLineText.startsWith("=>") &&
              !nextLineText.startsWith(")") && !nextLineText.startsWith("}") && !nextLineText.startsWith("]") && !nextLineText.startsWith(",") && !nextLineText.startsWith("?") && !nextLineText.startsWith(":") && !nextLineText.startsWith("&&") && !nextLineText.startsWith("??") && !nextLineText.startsWith("||")
            ) {
              foundEnd = true;
              break;
            }
          }
        }
        if (inArrowFunction && parenCount === 0 && trimmedLine2.includes(")")) {
          inArrowFunction = false;
        }
        endLine++;
      }
      if (!foundEnd) {
        vscode.window.showErrorMessage(
          "Could not find the end of the variable or function declaration!"
        );
        return;
      }
      if (/\s{\s*$/.test(trimmedLine) || /;\s*$/.test(trimmedLine)) {
        endLine = currentLine;
      }
      let maxRows = 100;
      let newLineText = document.lineAt(currentLine).text;
      let newCurrentLine = selection.active.line;
      let isParamsMultipleLine = false;
      while (newCurrentLine < document.lineCount) {
        newLineText = document.lineAt(newCurrentLine).text;
        if (maxRows <= 0) {
          break;
        }
        if (/\s{\s*$/.test(newLineText) && /,\s*$/.test(lineText)) {
          isParamsMultipleLine = true;
          endLine = newCurrentLine;
          break;
        }
        newCurrentLine++;
        maxRows--;
      }
      const config = vscode.workspace.getConfiguration("evonFlashConsole");
      const logType = config.get("logType", "log");
      const includeFilename = config.get("includeFileName", true);
      const includeLineNum = config.get("includeLineNum", true);
      const validLogTypes = ["info", "log", "debug", "warn", "error"];
      const finalLogType = validLogTypes.includes(logType) ? logType : "log";
      const fileName = document.fileName.split(/[\\/]/).pop() || "unknown";
      const lineNumber = endLine + 1;
      let logPrefix = "";
      if (includeFilename && includeLineNum) {
        logPrefix = `${fileName}:${lineNumber + 1} - ${variableName}:`;
      } else if (includeFilename) {
        logPrefix = `${fileName} - ${variableName}:`;
      } else if (includeLineNum) {
        logPrefix = `${lineNumber + 1} - ${variableName}:`;
      } else {
        logPrefix = `${variableName}:`;
      }
      const logStatement = `console.${finalLogType}("${logPrefix}", ${variableName});`;
      editor.edit((editBuilder) => {
        const insertPosition = new vscode.Position(endLine + 1, 0);
        editBuilder.insert(insertPosition, logStatement + "\n\n");
      }).then(() => {
        const newPosition = new vscode.Position(
          endLine + 1,
          logStatement.length
        );
        editor.selection = new vscode.Selection(newPosition, newPosition);
      });
    }
  );
  context.subscriptions.push(disposable);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
