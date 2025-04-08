const DatabaseConnection = require("../../database/database");
const { ObjectId } = require("mongodb");
const { getGenreObject } = require("../../models/genre"); // Model chỉ chứa hàm tạo object

class GenresController {
  // GET all genres - Render trang quản lý genres
  static async getAllGenres(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const genres = await db
        .collection("genres")
        .find()
        .sort({ name: 1 })
        .toArray();
      res.render("admin/genres/index", { genres, title: "Quản lý Thể Loại" });
    } catch (error) {
      console.error("Lỗi khi lấy tất cả thể loại:", error);
      next(error);
    }
  }

  // GET - Render form tạo genre mới
  static async getCreateGenreForm(req, res, next) {
    try {
      res.render("admin/genres/create", { title: "Thêm Thể Loại Mới" });
    } catch (error) {
      console.error("Lỗi khi cố gắng lấy form tạo thể loại:", error);
      next(error);
    }
  }

  // GET - Render form chỉnh sửa genre
  static async getEditGenreForm(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const genreId = new ObjectId(req.params.id);
      const genre = await db.collection("genres").findOne({ _id: genreId });

      if (!genre) {
        req.session.message = {
          type: "error",
          text: "Không tìm thấy thể loại nào!",
        };
        return res.redirect("/admin/genres");
      }
      res.render("admin/genres/edit", {
        genre,
        title: `Sửa Thể Loại: ${genre.name}`,
      });
    } catch (error) {
      console.error(
        `Lỗi khi lấy thể loại ${req.params.id} để chỉnh sửa:`,
        error
      );
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        req.session.message = {
          type: "error",
          text: "Số hiệu ID của thể loại không hợp lệ.",
        };
        return res.redirect("/admin/genres");
      }
      next(error);
    }
  }

  // POST - Tạo genre mới
  static async createGenre(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const existingGenre = await db
        .collection("genres")
        .findOne({ name: req.body.name });
      if (existingGenre) {
        req.session.message = {
          type: "error",
          text: `Thể loại "${req.body.name}" đã tồn tại!`,
        };
        return res.redirect("/admin/genres/create");
      }

      const genre = getGenreObject(req.body.name);
      const result = await db.collection("genres").insertOne(genre);
      console.log(`Genre created with ID: ${result.insertedId}`);
      req.session.message = {
        type: "success",
        text: "Thể loại được tạo thành công!",
      };
      res.redirect("/admin/genres");
    } catch (error) {
      console.error("Error creating genre:", error);
      req.session.message = {
        type: "error",
        text: `Lỗi khi tạo thể loại: ${error.message}`,
      };
      res.redirect("/admin/genres/create");
      // next(error);
    }
  }

  // POST - Cập nhật genre
  static async updateGenre(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const genreId = new ObjectId(req.params.id);
      const newName = req.body.name;
      const existingGenre = await db
        .collection("genres")
        .findOne({ name: newName, _id: { $ne: genreId } });
      if (existingGenre) {
        req.session.message = {
          type: "error",
          text: `Tên thể loại "${newName}" đã tồn tại!`,
        };
        return res.redirect(`/admin/genres/edit/${req.params.id}`);
      }

      const updateData = { name: newName };
      const result = await db
        .collection("genres")
        .updateOne({ _id: genreId }, { $set: updateData });

      if (result.matchedCount === 0) {
        req.session.message = {
          type: "error",
          text: "Không có thể loại nào để cập nhật.",
        };
      } else {
        req.session.message = {
          type: "success",
          text: "Thể loại đã được cập nhật thành công!",
        };
      }
      res.redirect("/admin/genres");
    } catch (error) {
      console.error(`Lỗi khi cập nhật thể loại ${req.params.id}:`, error);
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        req.session.message = {
          type: "error",
          text: "Số hiệu ID của thể loại không hợp lệ.",
        };
        return res.redirect("/admin/genres");
      }
      req.session.message = {
        type: "error",
        text: `Lỗi khi cập nhật thể loại: ${error.message}`,
      };
      res.redirect(`/admin/genres/edit/${req.params.id}`);
      // next(error);
    }
  }

  // POST - Xóa genre
  static async deleteGenre(req, res, next) {
    const genreIdParam = req.params.id;
    let genreId;

    //Validate id
    try {
      genreId = new ObjectId(genreIdParam);
    } catch (e) {
      req.session.message = {
        type: "error",
        text: "ID Thể Loại không hợp lệ.",
      };
      return res.redirect("/admin/genres");
    }

    try {
      const db = DatabaseConnection.getDb();
      const genreToDelete = await db
        .collection("genres")
        .findOne({ _id: genreId });

      if (!genreToDelete) {
        req.session.message = {
          type: "warning",
          text: "Thể loại không tìm thấy hoặc đã bị xóa.",
        };
        return res.redirect("/admin/genres");
      }

      const genreName = genreToDelete.name;
      console.log(
        `DEBUG: Kiểm tra sự sử dụng của thể loại tên: "[${genreName}]"`
      );
      const comicUsingGenre = await db.collection("comics").findOne({
        genres: { $regex: genreName, $options: "i" },
      });
      console.log(
        `DEBUG: Đã thấy được truyện sử dụng thể loại? ID:`,
        comicUsingGenre ? comicUsingGenre._id : null
      );
      if (comicUsingGenre) {
        console.warn(
          `Đã cố gắng để xóa thể loại "${genreName}" được sử dụng bởi thể loại ${comicUsingGenre._id}`
        );
        req.session.message = {
          type: "error",
          text: `Không thể xóa thể loại "${genreName}" vì đang có truyện sử dụng.`,
        };
        return res.redirect("/admin/genres");
      }
      const result = await db.collection("genres").deleteOne({ _id: genreId });

      if (result.deletedCount === 0) {
        req.session.message = {
          type: "warning",
          text: "Không thể xóa thể loại (có thể đã bị xóa bởi người khác).",
        };
      } else {
        console.log(`Đã xóa thể loại: ${genreName} (ID: ${genreIdParam})`);
        req.session.message = {
          type: "success",
          text: `Đã xóa thể loại "${genreName}" thành công!`,
        };
      }
      res.redirect("/admin/genres");
    } catch (error) {
      console.error(`Lỗi khi xóa thể loại ${genreIdParam}:`, error);
      req.session.message = {
        type: "error",
        text: `Lỗi khi xóa thể loại: ${error.message}`,
      };
      res.redirect("/admin/genres");
      // next(error);
    }
  }
}

module.exports = GenresController;
