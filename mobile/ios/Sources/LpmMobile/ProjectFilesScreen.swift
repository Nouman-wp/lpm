import SwiftUI
import UIKit

/// One folder of the project, as the desktop's Files tab lists it: folders push
/// another of these, files open in the preview. Go to File searches the whole
/// project from any folder.
struct ProjectFilesScreen: View {
    @Environment(AppModel.self) private var model
    let project: Project
    /// Project-relative; empty for the project's own folder.
    var dir = ""

    @State private var query = ""
    @State private var preview: FilePreviewTarget?

    private var listing: ProjectFolderListing { model.projectFiles.folder(project.name, dir) }
    private var root: String? { model.projectFiles.roots[project.name] }
    private var search: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        Group {
            if search.isEmpty {
                folderList
            } else {
                GoToFileResults(project: project.name, query: search, onOpen: open)
            }
        }
        .navigationTitle(dir.isEmpty ? "Files" : (dir as NSString).lastPathComponent)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Go to File")
        .onAppear {
            model.projectFiles.load(project.name, dir)
            model.loadMentions(project.name)
        }
        .sheet(item: $preview) { FilePreviewSheet(target: $0).environment(model) }
    }

    private var folderList: some View {
        List {
            if let entries = listing.entries {
                ForEach(entries) { entry in
                    let path = projectPath(dir, entry.name)
                    if entry.dir {
                        NavigationLink {
                            ProjectFilesScreen(project: project, dir: path)
                        } label: {
                            ProjectFileRow(entry: entry)
                        }
                        .contextMenu { copyRelativePath(path) }
                        .compactRow()
                    } else {
                        Button { open(path) } label: { ProjectFileRow(entry: entry) }
                            .contextMenu {
                                Button { open(path) } label: { Label("Preview", systemImage: "eye") }
                                if let root {
                                    Button { UIPasteboard.general.string = projectPath(root, path) } label: {
                                        Label("Copy Path", systemImage: "doc.on.doc")
                                    }
                                }
                                copyRelativePath(path)
                            }
                            .compactRow()
                    }
                }
            } else if listing.error == nil {
                ForEach([120.0, 150.0, 96.0, 170.0, 132.0], id: \.self) { FileRowSkeleton(width: $0).compactRow() }
            }
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
        .refreshable { await model.projectFiles.refresh(project.name, dir) }
        // Over the list, not in a row: ContentUnavailableView stretches a row.
        .overlay {
            if let error = listing.error {
                ContentUnavailableView {
                    Label("Can't Open This Folder", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Try Again") { model.projectFiles.load(project.name, dir) }
                        .buttonStyle(.borderedProminent)
                }
            } else if listing.entries?.isEmpty == true {
                ContentUnavailableView("Empty Folder", systemImage: "folder")
            }
        }
    }

    private func copyRelativePath(_ path: String) -> some View {
        Button { UIPasteboard.general.string = path } label: {
            Label("Copy Relative Path", systemImage: "doc.on.doc")
        }
    }

    private func open(_ path: String) {
        Haptics.tap()
        preview = FilePreviewTarget(project: project.name, path: path)
    }
}
