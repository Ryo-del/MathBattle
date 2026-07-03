#!/bin/bash

set -euo pipefail

if [ $# -ne 1 ]; then
    echo "Usage: $0 <project_directory>"
    exit 1
fi

PROJECT_DIR="$(cd "$1" && pwd)"
OUTPUT_FILE="$(pwd)/project.txt"

# Если project.txt находится внутри проекта — прекращаем работу
case "$OUTPUT_FILE" in
    "$PROJECT_DIR"/*)
        echo "Error: project.txt is inside the project directory."
        echo "Move it outside the project or change OUTPUT_FILE."
        exit 1
        ;;
esac

> "$OUTPUT_FILE"

find "$PROJECT_DIR" \
    \( \
        -path "*/.git" -o \
        -path "*/node_modules" -o \
        -path "*/vendor" -o \
        -path "*/bin" -o \
        -path "*/dist" -o \
        -path "*/build" -o \
        -path "*/target" -o \
        -path "*/.idea" -o \
        -path "*/.vscode" \
    \) -prune \
    -o -type f \
    ! -name "project.txt" \
    -print | sort | while read -r file; do

    rel="${file#$PROJECT_DIR}"

    printf "%s\n" "$rel" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    printf "\n\n" >> "$OUTPUT_FILE"
done

echo "Done! Output saved to $OUTPUT_FILE"