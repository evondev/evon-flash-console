import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
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
      let variableName: string | undefined;

      // Lấy tên biến từ vùng bôi đen hoặc con trỏ
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

      // Tìm dòng khai báo của biến
      let isSingleLine = false;
      const currentLine = selection.active.line;
      const lineText = document.lineAt(currentLine).text;
      const trimmedLine = lineText.trim();
      if (/\s{\s*$/.test(trimmedLine) || /;\s*$/.test(trimmedLine)) {
        isSingleLine = true;
      }
      let declarationLine = currentLine;
      let endLine = currentLine;
      let braceCount = 0; // Đếm dấu {}
      let parenCount = 0; // Đếm dấu ()
      let bracketCount = 0; // Đếm dấu []
      let inArrowFunction = false; // Đánh dấu nếu trong biểu thức =>
      let isBlockDeclaration = false; // Đánh dấu nếu là khối mã
      let foundEnd = false;
      let variableDeclarationFound = false;
      let declarationContent = ""; // Lưu nội dung toàn bộ khai báo

      // Tìm dòng khai báo biến (lên trên từ dòng hiện tại)
      for (let i = currentLine; i >= 0; i--) {
        const lineText = document.lineAt(i).text;
        const trimmedLine = lineText.trim();

        if (trimmedLine.match(/^(const|let|var)\s/)) {
          // Bắt đầu thu thập nội dung khai báo
          declarationLine = i;
          declarationContent = lineText;
          let j = i + 1;
          while (j < document.lineCount) {
            const nextLineText = document.lineAt(j).text;
            declarationContent += "\n" + nextLineText;
            const trimmedNextLine = nextLineText.trim();
            if (
              trimmedNextLine.endsWith(";") ||
              trimmedNextLine.includes("}")
            ) {
              break; // Dừng khi gặp dấu ; hoặc }
            }
            j++;
          }
          // Kiểm tra xem variableName có trong nội dung khai báo không
          if (declarationContent.includes(variableName)) {
            variableDeclarationFound = true;
            break;
          }
        }
        if (trimmedLine.includes("{")) {
          isBlockDeclaration = true;
        }
        if (trimmedLine.endsWith(";") || trimmedLine.includes("}")) {
          break; // Dừng nếu gặp dấu ; hoặc } trước khi tìm thấy khai báo
        }
      }

      // if (!variableDeclarationFound && !isSingleLine) {
      //   vscode.window.showErrorMessage(
      //     "Could not find the declaration of the selected variable!"
      //   );
      //   return;
      // }

      // Kiểm tra nếu khai báo nằm trong khối mã
      const declarationLineText = document.lineAt(declarationLine).text.trim();
      if (
        // declarationLineText.includes("=>") ||
        declarationLineText.includes("{")
      ) {
        isBlockDeclaration = true;
      }

      // Duyệt các dòng từ dòng khai báo để tìm điểm kết thúc
      endLine = declarationLine;
      while (endLine < document.lineCount) {
        const lineText = document.lineAt(endLine).text;
        const trimmedLine = lineText.trim();

        // Đếm dấu ngoặc và kiểm tra =>
        for (let i = 0; i < lineText.length; i++) {
          const char = lineText[i];
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
          } else if (
            char === "=" &&
            i + 1 < lineText.length &&
            lineText[i + 1] === ">" &&
            !inArrowFunction
          ) {
            inArrowFunction = true;
            i++; // Bỏ qua '>'
          }
        }

        // Kiểm tra nếu dòng kết thúc khai báo
        if (
          braceCount === 0 &&
          parenCount === 0 &&
          bracketCount === 0 &&
          !inArrowFunction
        ) {
          if (isBlockDeclaration) {
            // Nếu là khối mã (hàm), chèn sau dấu }
            if (trimmedLine.includes("}")) {
              foundEnd = true;
              break;
            }
          } else if (trimmedLine.endsWith(";")) {
            // Nếu là destructuring hoặc khai báo đơn giản, chèn sau dấu ;
            foundEnd = true;
            break;
          } else if (endLine > declarationLine) {
            // Kiểm tra dòng tiếp theo để xác định khai báo hoàn chỉnh
            const nextLineText =
              endLine + 1 < document.lineCount
                ? document.lineAt(endLine + 1).text.trim()
                : "";
            if (
              // !nextLineText.startsWith("=>") &&
              !nextLineText.startsWith(")") &&
              !nextLineText.startsWith("}") &&
              !nextLineText.startsWith("]") &&
              !nextLineText.startsWith(",") &&
              !nextLineText.startsWith("?") &&
              !nextLineText.startsWith(":") &&
              !nextLineText.startsWith("&&") &&
              !nextLineText.startsWith("??") &&
              !nextLineText.startsWith("||")
            ) {
              foundEnd = true;
              break;
            }
          }
        }

        // Thoát khỏi trạng thái arrow function
        if (inArrowFunction && parenCount === 0 && trimmedLine.includes(")")) {
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
      // generate more icons
      const icons = [
        "🚀",
        "⚡️",
        "🙈",
        "🔥",
        "💎",
        "🌟",
        "✨",
        "🎉",
        "🎊",
        "💥",
        "🌈",
        "🍀",
        "🍉",
        "🍓",
        "🍒",
        "🍍",
        "🥑",
        "🥝",
        "🥥",
        "🍋",
      ];
      const randomIcon = icons[Math.floor(Math.random() * icons.length)];

      // Lấy cấu hình từ settings.json
      const config = vscode.workspace.getConfiguration("evonFlashConsole");
      const logType = config.get<string>("logType", "log"); // Lấy logType, mặc định là 'log'
      const includeFilename = config.get<boolean>("includeFileName", true); // Lấy includeFilename, mặc định là true
      const includeLineNum = config.get<boolean>("includeLineNum", true); // Lấy includeLineNum, mặc định là true
      const prefixText = config.get<string>("prefixText", "🚀"); // Lấy prefixText, mặc định là ''
      const isRandomPrefixIcon = config.get<boolean>("randomPrefixIcon", false); // Lấy randomPrefixIcon, mặc định là false
      // Kiểm tra logType hợp lệ
      const validLogTypes = ["info", "log", "debug", "warn", "error"];
      const finalLogType = validLogTypes.includes(logType) ? logType : "log";

      // Lấy thông tin tệp và dòng
      const fileName = document.fileName.split(/[\\/]/).pop() || "unknown";
      // Số dòng sẽ là dòng tiếp theo sau khối mã
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

      // Tạo chuỗi console.info
      const logStatement = `console.${finalLogType}("${
        isRandomPrefixIcon ? `${randomIcon} ` : ""
      }${
        isRandomPrefixIcon ? "" : `${prefixText} `
      }${logPrefix}", ${variableName});`;

      // Chèn console.info vào dòng tiếp theo sau khối mã và thêm dòng trống
      editor
        .edit((editBuilder) => {
          const insertPosition = new vscode.Position(endLine + 1, 0);
          // Chèn console.info và một dòng trống phía dưới
          editBuilder.insert(insertPosition, logStatement + "\n\n");
        })
        .then(() => {
          // Di chuyển con trỏ đến cuối dòng console.info
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

export function deactivate() {}
